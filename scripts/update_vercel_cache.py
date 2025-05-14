import os
import requests
import json
import sys

def update_vercel_cache():
    """
    Script to invalidate and update the cache on Vercel deployment
    """
    # Get environment variables
    vercel_token = os.environ.get('VERCEL_TOKEN')
    deployment_url = os.environ.get('VERCEL_DEPLOYMENT_URL')
    project_id = os.environ.get('VERCEL_PROJECT_ID')
    
    if not all([vercel_token, deployment_url, project_id]):
        print("Error: Required environment variables not set.")
        print("Please set VERCEL_TOKEN, VERCEL_DEPLOYMENT_URL, and VERCEL_PROJECT_ID")
        sys.exit(1)
    
    # List all cache files
    cache_dir = 'cache'
    cache_files = [f for f in os.listdir(cache_dir) if f.endswith('.json')]
    
    # Purge cache for each file
    headers = {
        'Authorization': f'Bearer {vercel_token}',
        'Content-Type': 'application/json'
    }
    
    # Purge the entire cache directory
    purge_url = f'https://api.vercel.com/v9/projects/{project_id}/cache'
    purge_data = {
        'path': '/cache/*'
    }
    
    try:
        response = requests.post(purge_url, headers=headers, json=purge_data)
        if response.status_code == 200:
            print(f"Successfully purged cache directory")
        else:
            print(f"Failed to purge cache: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error purging cache: {str(e)}")
    
    print("Cache update process completed")

if __name__ == "__main__":
    update_vercel_cache() 