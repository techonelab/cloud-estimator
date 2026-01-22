import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const CostEstimator = () => {
  const [accountId, setAccountId] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [resources, setResources] = useState([]);
  const [serviceList, setServiceList] = useState([]);
  const [isCalculatingAll, setIsCalculatingAll] = useState(false);

  const BASE_URL = 'http://localhost:5000';

  const REGION_MAP = {
    'us-east-1': 'US East (N. Virginia)',
    'eu-central-1': 'Europe (Frankfurt)',
    'ap-southeast-1': 'Asia Pacific (Singapore)'
  };

  useEffect(() => {
    fetch(`${BASE_URL}/api/services`)
      .then(res => res.json())
      .then(data => setServiceList(data))
      .catch(err => console.error("Error fetching services:", err));
  }, []);

  const addResource = () => {
    const newResource = {
      id: Date.now(),
      service: '',
      attributes: [],
      allAttributes: [],
      options: {},
      showAdvanced: false,
      isLoadingOptions: false,
      selections: {},
      quantity: 1,
      estimatedCost: 0
    };
    setResources([...resources, newResource]);
  };

  const removeResource = (id) => {
    setResources(resources.filter(r => r.id !== id));
  };

  const handleServiceChange = async (resourceId, serviceCode) => {
    if (!serviceCode) return;
    setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isLoadingOptions: true, service: serviceCode } : r));
    try {
      const attrRes = await fetch(`${BASE_URL}/api/attributes/${serviceCode}`);
      const allAttributes = await attrRes.json();
      const priorityDrivers = ['instanceType', 'operatingSystem', 'databaseEngine', 'storageClass', 'volumeType', 'deploymentOption', 'cacheNodeType', 'engineCode', 'tenancy', 'licenseModel', 'databaseEdition', 'location', 'productFamily'];
      const smartAttributes = allAttributes.filter(attr => priorityDrivers.includes(attr));
      
      const priorityOptions = {};
      await Promise.all(smartAttributes.map(async (attr) => {
        try {
          // UPDATED: Added BASE_URL
          const valRes = await fetch(`${BASE_URL}/api/attribute-values/${serviceCode}/${attr}`);
          priorityOptions[attr] = await valRes.json();
        } catch (e) { priorityOptions[attr] = []; }
      }));

      setResources(prev => prev.map(res => 
        res.id === resourceId ? { 
          ...res, 
          attributes: smartAttributes, 
          allAttributes: allAttributes, 
          options: priorityOptions, 
          isLoadingOptions: false, 
          selections: { location: REGION_MAP[region] } 
        } : res
      ));
    } catch (err) {
      setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isLoadingOptions: false } : r));
    }
  };

  const handleSelectionChange = (resourceId, attr, value) => {
    setResources(resources.map(res => 
      res.id === resourceId ? { ...res, selections: { ...res.selections, [attr]: value } } : res
    ));
  };

  const calculateAll = async () => {
    setIsCalculatingAll(true);
    const updatedResources = await Promise.all(resources.map(async (res) => {
      if (!res.service) return res;
      try {
        // UPDATED: Added BASE_URL
        const response = await fetch(`${BASE_URL}/api/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: res.service,
            selections: { ...res.selections, location: REGION_MAP[region] },
            quantity: res.quantity
          })
        });
        const data = await response.json();
        return { ...res, estimatedCost: data.monthly_estimate || 0 };
      } catch (err) { return res; }
    }));
    setResources(updatedResources);
    setIsCalculatingAll(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-gray-50 min-h-screen text-slate-800">
      <h1 className="text-3xl font-bold mb-2">AWS Self-Service Cost Estimator</h1>
      <p className="text-blue-600 font-medium mb-8">Smart Attribute Discovery Enabled</p>

      {/* Global Settings */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8 space-y-4">
        <div className="grid grid-cols-[150px_1fr] items-center">
          <label className="text-sm font-bold text-gray-600">Tenant Account ID: </label>
          <input 
            className="border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none w-64"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-[150px_1fr] items-center">
          <label className="text-sm font-bold text-gray-600">Region: </label>
          <select 
            className="border rounded px-3 py-2 text-sm bg-white w-64"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            {Object.keys(REGION_MAP).map(r => <option key={r} value={r}>{REGION_MAP[r]}</option>)}
          </select>
        </div>
      </div>

      {/* Resource Cards */}
      <div className="space-y-6">
        {resources.map((res) => (
          <div key={res.id} className="bg-white p-8 rounded-xl border border-gray-200 shadow-md relative">
            <button onClick={() => removeResource(res.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
              <Trash2 size={20} />
            </button>

            <div className="space-y-4">
              <div className="grid grid-cols-[140px_1fr] items-center">
                <label className="text-sm font-bold text-gray-700">AWS Service: </label>
                <select 
                  className="border rounded p-2 text-sm bg-slate-50 w-full max-w-md"
                  value={res.service}
                  onChange={(e) => handleServiceChange(res.id, e.target.value)}
                >
                  <option value="">Select Service...</option>
                  {serviceList.map(svc => <option key={svc} value={svc}>{svc}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center">
                <label className="text-sm font-bold text-gray-700">Quantity: </label>
                <input 
                  type="number"
                  className="border rounded p-2 text-sm w-32"
                  value={res.quantity}
                  onChange={(e) => handleSelectionChange(res.id, 'quantity', parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Configuration: </span>
                  {res.service && (
                    <button 
                      onClick={() => setResources(resources.map(r => r.id === res.id ? {...r, showAdvanced: !r.showAdvanced} : r))}
                      className="text-xs text-blue-600 font-bold flex items-center gap-1 border border-blue-100 px-2 py-1 rounded bg-blue-50"
                    >
                      {res.showAdvanced ? <><ChevronUp size={14}/> Simple View</> : <><ChevronDown size={14}/> Advanced Discovery</>}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {res.isLoadingOptions ? (
                    <div className="flex items-center gap-2 text-blue-400 py-4"><Loader2 className="animate-spin" size={16} /> Fetching...</div>
                  ) : (
                    (res.showAdvanced ? res.allAttributes : res.attributes).map(attr => (
                      <div key={attr} className="grid grid-cols-[140px_1fr] items-center">
                        <label className="text-xs font-semibold text-gray-500">{attr}: </label>
                        {res.options[attr] ? (
                          <select 
                            className="border rounded p-1.5 text-sm bg-white w-full max-w-md"
                            value={res.selections[attr] || ''}
                            onChange={(e) => handleSelectionChange(res.id, attr, e.target.value)}
                          >
                            <option value="">Select {attr}...</option>
                            {res.options[attr].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input 
                            className="border rounded p-1.5 text-sm bg-gray-50 w-full max-w-md"
                            value={res.selections[attr] || ''}
                            onChange={(e) => handleSelectionChange(res.id, attr, e.target.value)}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-8">
        <button onClick={addResource} className="flex-1 py-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2">
          <Plus size={20} /> Add New Resource
        </button>
        <button 
          onClick={calculateAll} 
          disabled={isCalculatingAll}
          className="px-10 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 disabled:bg-gray-400"
        >
          {isCalculatingAll ? "Calculating..." : "Calculate All Estimates"}
        </button>
      </div>

      <div className="mt-12 bg-slate-900 text-white p-8 rounded-2xl shadow-xl">
        <h2 className="text-2xl font-bold mb-6 border-b border-slate-700 pb-4">Cost Summary</h2>
        <p className="text-slate-400 text-sm mb-6">Account ID: <span className="text-white font-mono">{accountId || 'Not Set'}</span></p>
        
        <div className="space-y-4 mb-8">
          {resources.map(r => (
            <div key={r.id} className="flex justify-between items-center font-mono text-sm">
              <span className="text-slate-400">{r.service || 'Unnamed Service'}:</span>
              <span className="text-green-400 font-bold">${(r.estimatedCost || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-slate-700">
          <span className="text-lg font-bold">Estimated Total:</span>
          <span className="text-4xl font-black text-blue-400">${resources.reduce((s, r) => s + (r.estimatedCost || 0), 0).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default CostEstimator;