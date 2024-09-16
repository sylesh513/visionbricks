from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

UPLOAD_FOLDER = '/Users/srisylesh/Documents/visionbricks/apiFiles/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def clear_upload_folder(folder):
    for filename in os.listdir(folder):
        file_path = os.path.join(folder, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print(f'Failed to delete {file_path}. Reason: {e}')

@app.route('/upload_workflow', methods=['POST'])
def upload_workflow():
    if 'workflowData' not in request.form:
        return jsonify({'error': 'No workflow data provided'}), 400

    workflow_data = json.loads(request.form['workflowData'])
    files = request.files
    print(files)
    print(workflow_data)

    # Clear the upload folder
    clear_upload_folder(UPLOAD_FOLDER)

    # Save workflow data to a file
    with open(os.path.join(UPLOAD_FOLDER, 'workflow.json'), 'w') as f:
        json.dump(workflow_data, f, indent=2)

    # Save each file and associate it with the corresponding node
    for node in workflow_data['nodes']:
        node_name = node['name']
        if node_name in files:
            file = files[node_name]
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
            "dependencies": [str(dep) for dep in node['connections']],
            "file": node.get('file', None)  # Include the file path if it exists
        }
        new_workflow_data["tasks"].append(new_task)

    # Save the transformed workflow data
    with open(os.path.join(UPLOAD_FOLDER, 'workflow_with_files.json'), 'w') as f:
        json.dump(new_workflow_data, f, indent=2)

    return jsonify({'message': 'Workflow data and files uploaded successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)