from flask import Flask, request, jsonify
from calculator import AWSCostEstimator

app = Flask(__name__)
calc = AWSCostEstimator()

@app.route('/services', methods=['GET'])
def list_services():
    # Step 1: UI calls this to fill the first dropdown
    return jsonify(calc.get_all_svc_codes())

@app.route('/attributes/<service_code>', methods=['GET'])
def get_attribs(service_code):
    # Step 2: UI calls this to find out what dropdowns to build
    return jsonify(calc.get_svc_attributes(service_code))

@app.route('/estimate', methods=['POST'])
def estimate():
    # Step 3: UI calls this to get the final price
    data = request.json
    # data format: {"service": "AmazonEC2", "selections": {...}, "quantity": 1}
    result = calc.calculate_estimate(data['service'], data['selections'], data.get('quantity', 1))
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)