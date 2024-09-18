from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import shutil
import requests
import base64
import time
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

UPLOAD_FOLDER = '/home/vesh/angular-drawflow-ttbyqn/apiFiles/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Databricks API credentials
DATABRICKS_HOST = os.getenv('DATABRICKS_HOST')
DATABRICKS_TOKEN = os.getenv('DATABRICKS_TOKEN')
CLUSTER_ID = os.getenv('CLUSTER_ID')

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

def get_task_key(task_name):
    return task_name.replace(" ", "_").lower()

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
    response = requests.post(upload_url, headers={"Authorization": f"Bearer {DATABRICKS_TOKEN}"}, json=payload)
    
    if response.status_code == 200:
        print(f"Uploaded Python file to Databricks notebook: {notebook_path}")
    else:
        raise Exception(f"Error uploading Python file: {response.text}")

def create_and_run_databricks_job(data):
    # Create the Databricks job
    create_job_url = f"{DATABRICKS_HOST}/api/2.1/jobs/create"
    
    # Job creation payload
    job_payload = {
        "name": data["workflow_name"],
        "tasks": [],
        "max_concurrent_runs": 1  # Ensure tasks run sequentially
    }
    
    # Create a dictionary to map task IDs to task keys
    task_key_map = {}
    
    # Create tasks for the workflow
    for task in data["tasks"]:
        task_key = get_task_key(task["task_name"])
        task_key_map[task["task_id"]] = task_key
        
        # Define the notebook path on Databricks
        notebook_path = f"/Workspace/Users/hackathon_ai10@centific.com/POD_K2/conf/{task_key}_notebook"
        
        # Upload the Python file as a notebook
        upload_python_file_as_notebook(task["file"], notebook_path)
        
        # Define the job task
        job_task = {
            "task_key": task_key,
            "notebook_task": {
                "notebook_path": notebook_path,  # Use the uploaded notebook
                "base_parameters": {
                    "one": "1",
                }
                    # task.get("params", {})  # Can add parameters if needed
            },
            "existing_cluster_id": CLUSTER_ID  # Use the existing cluster
        }
        print("jobajba")
        print(job_task)    
        
        if task["dependencies"]:
            job_task["depends_on"] = [{"task_key": task_key_map.get(dep_task_id)} for dep_task_id in task["dependencies"] if task_key_map.get(dep_task_id)]
        
        job_payload["tasks"].append(job_task)
    
    response = requests.post(create_job_url, headers={"Authorization": f"Bearer {DATABRICKS_TOKEN}"}, json=job_payload)
    
    if response.status_code == 200:
        job_id = response.json().get('job_id')
        print(f"Job '{data['workflow_name']}' created successfully. Job ID: {job_id}")
    else:
        raise Exception(f"Error creating job: {response.text}")
    
    # Run the created job
    run_job_url = f"{DATABRICKS_HOST}/api/2.1/jobs/run-now"
    run_payload = {
        "job_id": job_id
    }
    
    run_response = requests.post(run_job_url, headers={"Authorization": f"Bearer {DATABRICKS_TOKEN}"}, json=run_payload)
    
    if run_response.status_code == 200:
        run_id = run_response.json().get('run_id')
        print(f"Job {job_id} started successfully. Run ID: {run_id}")
    else:
        raise Exception(f"Error running job: {run_response.text}")
    
    # Check the job status with real-time task updates
    check_status_url = f"{DATABRICKS_HOST}/api/2.1/jobs/runs/get"
    
    # Keep track of task statuses
    task_statuses = {}

    while True:
        status_response = requests.get(check_status_url, headers={"Authorization": f"Bearer {DATABRICKS_TOKEN}"}, params={"run_id": run_id})
        
        if status_response.status_code == 200:
            response_data = status_response.json()
            run_status = response_data.get('state').get('life_cycle_state')
            print(f"Run {run_id} status: {run_status}")
            
            # Fetch and print task-level statuses
            tasks = response_data.get('tasks', [])
            for task in tasks:
                task_key = task.get('task_key')  # Use get to avoid KeyError
                task_state = task['state']['life_cycle_state']

                # Try to get the task_id, if not found, use 'N/A'
                task_id = task.get('task_id', 'N/A')  # 'N/A' if task_id is not present
                task_name = task.get('task_name', task_key)  # Fallback to task_key if task_name is not available

                # Check if the task state has changed and print updates
                if task_key not in task_statuses or task_statuses[task_key] != task_state:
                    print(f"Task '{task_name}' (ID: {task_id}) status: {task_state}")
                    
                    # If task has completed, print task information
                    if task_state == 'TERMINATED':
                        task_run_info = task.get('run_info', {})
                        print(f"Task '{task_name}' (ID: {task_id}) completed. Info:")
                        print(f"- Start Time: {task_run_info.get('start_time')}")
                        print(f"- End Time: {task_run_info.get('end_time')}")
                        print(f"- Result State: {task_run_info.get('result_state')}")
                        print(f"- Life Cycle State: {task_state}")

                    task_statuses[task_key] = task_state
            
            # Check if the overall job has completed
            if run_status in ['TERMINATED', 'SKIPPED', 'INTERNAL_ERROR']:
                print(f"Job {job_id} completed with status: {run_status}")
                break
        else:
            raise Exception(f"Error fetching job status: {status_response.text}")
        
        # Wait for 1 second before checking the status again
        time.sleep(1)

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
            "base_parameters": {
                "one" : "1"
                }  # Include the params if they exist
        }
        print("thejson")
        print(new_task)
        print(node.get('params', ""))
        new_workflow_data["tasks"].append(new_task)

    # Save the transformed workflow data
    with open(os.path.join(UPLOAD_FOLDER, 'workflow_with_files.json'), 'w') as f:
        json.dump(new_workflow_data, f, indent=2)

    # Run the final logic
    try:
        create_and_run_databricks_job(new_workflow_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify({'message': 'Workflow data and files uploaded successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)