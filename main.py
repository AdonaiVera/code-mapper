from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import uvicorn
import os
import json

app = FastAPI(title="CodeMapper")

# Set up templates
templates = Jinja2Templates(directory="src")

# Root endpoint to serve the HTML
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Serve static files (CSS, JS, SVG, etc.)
app.mount("/static", StaticFiles(directory="src/static"), name="static")
app.mount("/cache", StaticFiles(directory="cache"), name="cache")

# API endpoints for our application
@app.get("/api/developers", tags=["Developers"])
async def get_developers():
    """
    Return developer data (this would typically come from a database or API)
    """
    return {
        "data": [
            {
                "country": "Algeria",
                "developers": [
                    {
                        "name": "Mohamed Ali",
                        "handle": "mohamedcoder",
                        "company": "TechAlgiers",
                        "location": "Algiers, Algeria",
                        "publicContributions": 785,
                        "totalContributions": 1342,
                        "followers": 321,
                        "twitter": "@mohamedcoder",
                        "avatar": "/static/images/avatars/dev1.svg"
                    },
                    {
                        "name": "Fatima Zohra",
                        "handle": "fatimadev",
                        "company": "OranCode",
                        "location": "Oran, Algeria",
                        "publicContributions": 652,
                        "totalContributions": 980,
                        "followers": 245,
                        "twitter": "@fatimadev",
                        "avatar": "/static/images/avatars/dev2.svg"
                    }
                ]
            },
            {
                "country": "USA",
                "developers": [
                    {
                        "name": "John Smith",
                        "handle": "johnsmith",
                        "company": "TechGiant",
                        "location": "San Francisco, USA",
                        "publicContributions": 1245,
                        "totalContributions": 1985,
                        "followers": 842,
                        "twitter": "@johnsmith",
                        "avatar": "/static/images/avatars/dev3.svg"
                    }
                ]
            }
        ]
    }

@app.get("/api/countries", tags=["Countries"])
async def get_countries():
    """
    Return available countries data
    """
    return {
        "data": [
            {"name": "Algeria", "code": "DZ", "region": "Africa"},
            {"name": "USA", "code": "US", "region": "North America"},
            # Add more countries as needed
        ]
    }

@app.get("/get_countries", tags=["Countries"])
async def get_countries_from_cache():
    """
    Dynamically get all countries from the JSON files in the cache directory
    """
    countries = []
    cache_dir = "cache"
    
    try:
        # Get all JSON files from the cache directory
        json_files = [f for f in os.listdir(cache_dir) if f.endswith('.json')]
        
        # Extract country names from filenames
        for json_file in json_files:
            country_name = json_file[:-5]  # Remove .json extension
            
            # Convert underscore to space and capitalize each word
            formatted_name = ' '.join(word.capitalize() for word in country_name.split('_'))
            
            # Add country to list with default region
            countries.append({
                "name": formatted_name,
                "code": "",  # We could extract this from the JSON file if needed
                "region": None  # We'll generate regions on the client side
            })
        
        # Sort countries alphabetically by name
        countries.sort(key=lambda x: x["name"])
        
        return countries
    except Exception as e:
        print(f"Error fetching countries: {str(e)}")
        return []

# Run the server when this file is executed directly
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
