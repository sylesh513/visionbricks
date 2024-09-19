import socketio

# URL of the Flask-SocketIO server
SERVER_URL = 'http://localhost:5000'  # Replace with your server URL if different

# Create a Socket.IO client
sio = socketio.Client()

# Define event handlers
@sio.event
def connect():
    print('Connected to server')
    # Emit the 'run_workflow' event to trigger the workflow
    sio.emit('run_workflow')

@sio.event
def disconnect():
    print('Disconnected from server')

@sio.event
def task_update(data):
    print(f"Task update received: {data}")

@sio.event
def job_completed(data):
    print(f"Job completed: {data}")
    # Disconnect after job completion
    sio.disconnect()

# Connect to the server
sio.connect(SERVER_URL)

# Wait for events
sio.wait()