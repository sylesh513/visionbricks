from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/upload_workflow', methods=['POST'])
def upload_workflow():
    if 'workflowData' not in request.form:
        return jsonify({'error': 'No workflow data provided'}), 400

    workflow_data = json.loads(request.form['workflowData'])
    files = request.files

    # Save workflow data to a file
    with open(os.path.join(UPLOAD_FOLDER, 'workflow.json'), 'w') as f:
        json.dump(workflow_data, f, indent=2)

    # Save each file and associate it with the corresponding node
    for node in workflow_data['nodes']:
        file_key = f"file_{node['id']}"
        if file_key in files:
            file = files[file_key]
            file_path = os.path.join(UPLOAD_FOLDER, file.filename)
            file.save(file_path)
            node['file'] = file_path  # Update the node's file information

    # Transform the workflow data to the new format
    new_workflow_data = {
        "workflow_name": "Data Analysis Pipeline",
        "tasks": []
    }

    id_to_task_name = {node['id']: node['name'] for node in workflow_data['nodes']}
    for node in workflow_data['nodes']:
        new_task = {
            "task_id": str(node['id']),
            "task_name": node['name'],
            "dependencies": [str(dep) for dep in node['connections']]
        }
        new_workflow_data["tasks"].append(new_task)

    # Save the transformed workflow data
    with open(os.path.join(UPLOAD_FOLDER, 'workflow_with_files.json'), 'w') as f:
        json.dump(new_workflow_data, f, indent=2)

    return jsonify({'message': 'Workflow data and files uploaded successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)