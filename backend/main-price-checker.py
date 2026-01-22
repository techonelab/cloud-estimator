from flask import Flask, request, jsonify
from flask_cors import CORS 
from calculator import AWSCostEstimator

app = Flask(__name__)
CORS(app)

estimator = AWSCostEstimator()

@app.route('/api/services', methods=['GET'])
def get_services():
    return jsonify(estimator.get_all_svc_codes())

@app.route('/api/attributes/<service_code>', methods=['GET'])
def get_attributes(service_code):
    return jsonify(estimator.get_svc_attributes(service_code))

@app.route('/api/attribute-values/<service_code>/<attr_name>', methods=['GET'])
def get_values(service_code, attr_name):
    return jsonify(estimator.get_svc_attribute_values(service_code, attr_name))

@app.route('/api/estimate', methods=['POST'])
def get_estimate():
    data = request.get_json()
    service_code = data.get('service')
    selections = data.get('selections', {})
    quantity = data.get('quantity', 1)

    # Use the logic in calculator.py
    result = estimator.calculate_estimate(service_code, selections, quantity)
    return jsonify(result)

if __name__ == '__main__':
    # host='0.0.0.0' makes it accessible on your local network
    app.run(host='0.0.0.0', port=5000, debug=True)