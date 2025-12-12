import requests
import json
import sseclient

def test_chat(prompt, agent_id=None):
    print(f"\n--- Testing Prompt: {prompt} ---")
    url = "http://localhost:8001/api/chat/stream"
    payload = {
        "prompt": prompt,
        "agent_id": agent_id,
        "history": [],
        "context": {}
    }
    
    response = requests.post(url, json=payload, stream=True)
    client = sseclient.SSEClient(response)
    
    for event in client.events():
        print(f"[{event.event}]: {event.data}")
        if event.event == "error":
            print("Error encountered!")
            break

if __name__ == "__main__":
    # Test 1: Mindmap intent
    test_chat("Create a mindmap about AI Agents")
    
    # Test 2: Flow intent
    test_chat("Create a flowchart for login process")
    
    # Test 3: Charts intent
    test_chat("Create a bar chart for sales data")
