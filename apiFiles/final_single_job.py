import eventlet
eventlet.monkey_patch()
import json
import os
import shutil
import requests
import base64
import time
from flask import Flask, jsonify, render_template, request, send_file
from flask_socketio import SocketIO, emit
from datetime import datetime, timezone
from flask_cors import CORS

JSON_FILE_PATH = '/home/vesh/angular-drawflow-ttbyqn/apiFiles/job_final_status.json'

# Initialize Flask and Flask-SocketIO
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) 
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')  # Enable CORS for SocketIO
# Enable CORS for all origins
 # Enable CORS for all routes


# Databricks API credentials
UPLOAD_FOLDER = '/home/vesh/angular-drawflow-ttbyqn/apiFiles/uploads'

DATABRICKS_HOST = 'https://adb-2391317195324727.7.azuredatabricks.net'  # Replace with your Databricks host
DATABRICKS_TOKEN = 'dapic5246a60410c2a1e1a459e987b516f87-3'  # Replace with your Databricks token
CLUSTER_ID = '0913-052228-mn4cbjcl'  # Replace with your cluster ID

# Track if a job is currently running
is_running = False

# Load the JSON file containing the workflow data
with open('/home/vesh/angular-drawflow-ttbyqn/apiFiles/uploads/workflow_with_files.json') as f:
    data = json.load(f)

# Define headers for Databricks API
headers = {"Authorization": f"Bearer {DATABRICKS_TOKEN}"}

# Helper function to get task key from task name
def get_task_key(task_name):
    return task_name.replace(" ", "_").lower()

# Helper function to upload Python file as a notebook in Databricks
def upload_python_file_as_notebook(file_path, notebook_path):
    upload_url = f"{DATABRICKS_HOST}/api/2.0/workspace/import"

    # Read the Python file
    with open(file_path, 'r') as f:
        python_code = f.read()

    # Encode the Python code in base64
    encoded_python_code = base64.b64encode(python_code.encode('utf-8')).decode('utf-8')
    
    # Prepare the payload for the Databricks import API
    payload = {
        "path": notebook_path,
        "format": "SOURCE",
        "language": "PYTHON",
        "content": encoded_python_code,
        "overwrite": True
    }
    
    # Call the Databricks API to upload the file
    response = requests.post(upload_url, headers=headers, json=payload)
    
    if response.status_code == 200:
        print(f"Uploaded Python file to Databricks notebook: {notebook_path}")
    else:
        raise Exception(f"Error uploading Python file: {response.text}")
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

# Function to create and run Databricks job, with real-time task updates
def create_and_run_databricks_job():
    global is_running
    
    if is_running:
        socketio.emit('execution_in_progress', 'Another execution is already in progress.')
        print("Another execution is already in progress.")
        return
    
    # Mark the job as running
    is_running = True
    
    create_job_url = f"{DATABRICKS_HOST}/api/2.1/jobs/create"
    job_payload = {
        "name": data["workflow_name"],
        "tasks": [],
        "max_concurrent_runs": 1
    }
    task_key_map = {}
    job_status = {
        "jobId": None,
        "jobName": data["workflow_name"],
        "status": "RUNNING",
        "tasks": []
    }
    
    # Create tasks for the workflow
    for task in data["tasks"]:
        task_key = get_task_key(task["task_name"])
        task_key_map[task["task_id"]] = task_key
        notebook_path = f"/Workspace/Users/hackathon_ai10@centific.com/POD_K2/conf/{task_key}_notebook"
        upload_python_file_as_notebook(task["file"], notebook_path)
        
        job_task = {
            "task_key": task_key,
            "notebook_task": {
                "notebook_path": notebook_path,
                "base_parameters": task.get("base_parameters", {})
            },
            "existing_cluster_id": CLUSTER_ID
        }
        print("task")
        print(task)
        print(task.get("base_parameters", {}))
        if task["dependencies"]:
            job_task["depends_on"] = [{"task_key": task_key_map.get(dep_task_id)} for dep_task_id in task["dependencies"] if task_key_map.get(dep_task_id)]
        
        job_payload["tasks"].append(job_task)
        job_status["tasks"].append({
            "name": task["task_name"],
            "runId": None,
            "status": "PENDING",
            "statusHistory": [{"status": "PENDING", "timestamp": datetime.now(timezone.utc).isoformat()}]
        })

    # Create job via Databricks API
    response = requests.post(create_job_url, headers=headers, json=job_payload)
    if response.status_code == 200:
        job_id = response.json().get('job_id')
        job_status["jobId"] = job_id
        print(f"Job '{data['workflow_name']}' created successfully. Job ID: {job_id}")
    else:
        raise Exception(f"Error creating job: {response.text}")
    
    # Run the created job
    run_job_url = f"{DATABRICKS_HOST}/api/2.1/jobs/run-now"
    run_payload = {"job_id": job_id}
    run_response = requests.post(run_job_url, headers=headers, json=run_payload)
    if run_response.status_code == 200:
        run_id = run_response.json().get('run_id')
        print(f"Job {job_id} started successfully. Run ID: {run_id}")
    else:
        raise Exception(f"Error running job: {run_response.text}")
    
    # Check the job status with real-time task updates
    check_status_url = f"{DATABRICKS_HOST}/api/2.1/jobs/runs/get"
    task_statuses = {}

    while True:
        status_response = requests.get(check_status_url, headers=headers, params={"run_id": run_id})
        if status_response.status_code == 200:
            response_data = status_response.json()
            run_status = response_data.get('state').get('life_cycle_state')
            print(f"Run {run_id} status: {run_status}")
            
            tasks = response_data.get('tasks', [])
            for task in tasks:
                task_key = task.get('task_key')
                task_state = task['state']['life_cycle_state']
                task_run_id = task.get('run_id', 'N/A')
                task_name = task.get('task_name', task_key)
                
                task_status_entry = next((t for t in job_status["tasks"] if t["name"] == task_name), None)
                if task_key not in task_statuses or task_statuses[task_key] != task_state:
                    print(f"Task '{task_name}' (Run ID: {task_run_id}) status: {task_state}")
                    if task_status_entry and task_status_entry["runId"] is None:
                        task_status_entry["runId"] = task_run_id
                    if task_status_entry:
                        task_status_entry["statusHistory"].append({
                            "status": task_state,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    task_statuses[task_key] = task_state

                    # Send status updates to the frontend using WebSockets
                    socketio.emit('task_update', {
                        'task_name': task_name,
                        'status': task_state,
                        'run_id': task_run_id
                    })
            
            if run_status in ['TERMINATED', 'SKIPPED', 'INTERNAL_ERROR']:
                print(f"Job {job_id} completed with status: {run_status}")
                job_status["status"] = run_status
                socketio.emit('job_completed', {'job_id': job_id, 'status': run_status})
                break
        else:
            raise Exception(f"Error fetching job status: {status_response.text}")
        
        time.sleep(1)

    output_file = '/home/vesh/angular-drawflow-ttbyqn/apiFiles/job_final_status.json'
    with open(output_file, 'w') as f:
        json.dump(job_status, f, indent=4)
    
    print(f"Final job status saved to {output_file}")

    # Reset the running status once the job is finished
    is_running = False

# Route for homepage
@app.route('/')
def index():
    return render_template('index.html')

# WebSocket route for handling the "run" event from frontend
@socketio.on('run_workflow')
def handle_run_workflow():
    print("Workflow run triggered from frontend")
    create_and_run_databricks_job()
@app.route('/upload_workflow', methods=['POST'])
def upload_workflow():
    if 'workflowData' not in request.form:
        return jsonify({'error': 'No workflow data provided'}), 400

    workflow_data = json.loads(request.form['workflowData'])
    files = request.files
    # print(files)
    # print(workflow_data)

    # Clear the upload folder
    clear_upload_folder(UPLOAD_FOLDER)

    # Save workflow data to a file
    with open(os.path.join(UPLOAD_FOLDER, 'workflow.json'), 'w') as f:
        json.dump(workflow_data, f, indent=2)

    # Create a mapping of node names to node IDs
    name_to_id = {node['name']: str(node['id']) for node in workflow_data['nodes']}

    # Initialize dependencies for each node
    dependencies = {str(node['id']): [] for node in workflow_data['nodes']}

    # Populate dependencies based on connections
    for node in workflow_data['nodes']:
        for connection in node['connections']:
            if connection in name_to_id:
                dependencies[name_to_id[connection]].append(str(node['id']))

    # Save each file and associate it with the corresponding node
    for node in workflow_data['nodes']:
        node_name = node['name']
        if node_name in files:
            file = files[node_name]
            file_path = os.path.join(UPLOAD_FOLDER, file.filename)
            file.save(file_path)
            node['file'] = file_path  # Update the node's file information

    # Create the new task structure
    new_workflow_data = {
        "workflow_name": "Data Analysis Pipeline",
        "tasks": []
    }

    for node in workflow_data['nodes']:
        new_task = {
            "task_id": str(node['id']),
            "task_name": node['name'],
            "dependencies": dependencies[str(node['id'])],
            "file": node.get('file', None),  # Include the file path if it exists
            "base_parameters": node.get('params', {}) # Include the params if they exist
        }
        new_workflow_data["tasks"].append(new_task)

    # Save the transformed workflow data
    with open(os.path.join(UPLOAD_FOLDER, 'workflow_with_files.json'), 'w') as f:
        json.dump(new_workflow_data, f, indent=2)

    # Run the final logic

    return jsonify({'message': 'Workflow data and files uploaded successfully'}), 200

# Route for downloading a file
@app.route('/download', methods=['GET'])
def download_json():
    try:
        file_path = os.path.join(JSON_FILE_PATH)
        
        # Ensure the file exists before attempting to send it
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        return send_file(file_path, as_attachment=True, mimetype='application/json')
    
    except Exception as e:
        return str(e), 500# Entry point for the app with SocketIO
if __name__ == '__main__':
    socketio.run(app, debug=True, use_reloader=False)
