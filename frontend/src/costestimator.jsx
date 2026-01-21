import React, { useState, useEffect } from 'react';
import { Calculator, Plus, Trash2, Info, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const CostEstimator = () => {
  const [accountId, setAccountId] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [resources, setResources] = useState([]);
  const [serviceList, setServiceList] = useState([]); // Dynamic list from API
  const [loadingServices, setLoadingServices] = useState(true);

  // 1. Fetch the master service list when the page loads
  useEffect(() => {
    fetch('/api/services')
      .then(res => res.json())
      .then(data => {
        setServiceList(data);
        setLoadingServices(false);
      })
      .catch(err => console.error("Error fetching services:", err));
  }, []);

  const addResource = () => {
    const newResource = {
      id: Date.now(),
      service: '',
      attributes: [], // Will hold the discovered dropdown names (e.g. instanceType)
      selections: {}, // Will hold user choices (e.g. {instanceType: 't3.medium'})
      quantity: 1,
      estimatedCost: 0
    };
    setResources([...resources, newResource]);
  };

  // 2. Fetch attributes (questions) when a service is picked in a card
  const handleServiceChange = async (resourceId, serviceCode) => {
    const response = await fetch(`/api/attributes/${serviceCode}`);
    const attributes = await response.json();
    
    // Whitelist common attributes so we don't show 60 dropdowns
    const whitelist = ['instanceType', 'operatingSystem', 'databaseEngine', 'storageClass', 'volumeType', 'cacheNodeType'];
    const filteredAttribs = attributes.filter(attr => whitelist.includes(attr));

    setResources(resources.map(res => 
      res.id === resourceId 
        ? { ...res, service: serviceCode, attributes: filteredAttribs, selections: {} } 
        : res
    ));
  };

  const removeResource = (id) => {
    setResources(resources.filter(r => r.id !== id));
  };

  const totalCost = resources.reduce((sum, res) => sum + (res.estimatedCost || 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen font-sans">
      {/* Header Area */}
      <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Info className="text-blue-600" /> AWS Self-Service Cost Estimator - by CCC
          </h1>
          <p className="text-sm text-gray-500 mt-1">Estimate changes to  account before deployment.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Account ID: </label>
            <input 
              type="text" 
              placeholder="123456789012"
              className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Region: </label>
            <select 
              className="mt-1 px-3 py-2 border rounded-md bg-white cursor-pointer"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="us-east-2">US East (Ohio)</option>
              <option value="eu-central-1">EU (Frankfurt)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Resource Area */}
        <div className="lg:col-span-2 space-y-6">
          {resources.map((res) => (
            <div key={res.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative transition-all hover:border-blue-300">
              <button 
                onClick={() => removeResource(res.id)}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Select AWS Service</label>
                  <select 
                    className="w-full border border-gray-300 rounded-md p-2 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={res.service}
                    onChange={(e) => handleServiceChange(res.id, e.target.value)}
                  >
                    <option value="">Choose a service...</option>
                    {serviceList.map(svc => <option key={svc} value={svc}>{svc}</option>)}
                  </select>
                </div>

                {/* Dynamic Attributes Area: This loops through whatever the backend sent back */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Configuration</label>
                  {res.attributes.length === 0 ? (
                    <div className="text-xs text-gray-400 italic mt-2">Select a service to see options...</div>
                  ) : (
                    <div className="space-y-3">
                      {res.attributes.map(attr => (
                        <div key={attr}>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">{attr}</span>
                          <input 
                            type="text" 
                            placeholder={`e.g. ${attr === 'instanceType' ? 't3.medium' : 'Linux'}`}
                            className="w-full border rounded p-2 text-sm mt-0.5"
                            onChange={(e) => {
                                // Logic to update selections state goes here
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity</label>
                  <input 
                    type="number" 
                    className="w-full border border-gray-300 rounded-md p-2" 
                    value={res.quantity}
                    onChange={(e) => { /* Update quantity logic */ }}
                  />
                </div>
              </div>
            </div>
          ))}

          <button 
            onClick={addResource}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-medium"
          >
            <Plus size={20} /> Add New AWS Resource
          </button>
        </div>

        {/* Sidebar Summary Area */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden sticky top-6">
            <div className="bg-slate-800 p-4 text-white">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Info size={18}/> Cost Summary</h2>
              <p>Please note that this is just an approximate amount due to enterprise discount, actual price may vary.</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Account ID: {accountId || 'Please put your Account ID'}</p>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between items-end mb-6">
                <span className="text-gray-500 text-sm">Estimated Total: </span>
                <span className="text-3xl font-bold text-gray-900">${totalCost.toFixed(2)}<span className="text-sm font-normal text-gray-400 ml-1">/mo</span></span>
              </div>

              <div className="border-t border-gray-100 pt-4 mb-6">
                {resources.length === 0 ? (
                  <p className="text-center text-gray-400 italic text-sm">Add a resource to start</p>
                ) : (
                  resources.map(r => (
                    <div key={r.id} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">{r.service || 'New Resource: '}</span>
                      <span className="font-medium text-gray-800">${r.estimatedCost || '0.00'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostEstimator;