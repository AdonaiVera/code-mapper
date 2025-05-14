# 🌍 CodeMapper: Pixel World of Devs

A pixel-art style visualization of top GitHub contributors from around the world. This project creates an interactive pixel-art map where each country lights up when clicked, revealing a panel with top GitHub contributors styled as pixel character cards.

## 📹 Demo


Check out the live demo: [CodeMapper on Vercel](https://code-mapper-cdkpgpjab-adonaiveras-projects.vercel.app/)

## 🎮 Features

- **Pixel Art World Map**: Interactive map with hover and click effects
- **Searchable Interface**: Find developers or countries
- **Pixel RPG Profile Cards**: View developer stats in a retro game style
- **Filter Tabs**: Sort by public/total contributions or followers
- **Responsive Design**: Works on desktop and mobile

## 🚀 Setup & Running

### Prerequisites

- Python 3.8+
- pip (Python package manager)
- GitHub Personal Access Token (for data fetching)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/AdonaiVera/code-mapper
   cd code-mapper
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv env
   source env/bin/activate  # On Windows: env\Scripts\activate
   ```

3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

1. Start the application:
   ```bash
   python main.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

### Docker (Alternative)

If you prefer using Docker:

```bash
docker build -t code-mapper .
docker run -p 8000:8000 code-mapper
```

### 🚢 Vercel Deployment

To deploy this project to Vercel with automatic cache updates:

1. Fork this repository
2. Create a Vercel account and link your GitHub repository
3. Add the following environment variables in Vercel:
   - `VERCEL_TOKEN`: Your Vercel API token
   - `VERCEL_PROJECT_ID`: Your Vercel project ID

4. The workflow will:
   - Deploy your application to Vercel
   - Automatically update and invalidate the cache when new data is available
   - Ensure the latest country data is always accessible

The deployment process handles cache invalidation through the Vercel API, ensuring your users always see the most recent data without manual intervention.

### Manual Deployment

If you want to deploy your own instance:

1. Fork this repository
2. Go to your repository settings → Pages
3. Enable GitHub Pages from the Actions workflow
4. The site will be automatically deployed when you push changes or when the daily data update runs

## ⏱️ Data Updates

This project uses GitHub Actions to automatically update the developer data every 24 hours. The workflow is configured to:

1. Fetch the latest GitHub user data using the GitHub GraphQL API
2. Process and sort the data by contributions and followers
3. Update the cached data files
4. Regenerate the visualization with fresh data
5. Deploy the updated site to GitHub Pages

You can manually trigger an update by going to the Actions tab in your repository and running the workflow.

## 🧠 Technical Stack

- **Backend**: FastAPI (Python)
- **Frontend**: HTML5, CSS3, JavaScript
- **Map Rendering**: PixiJS
- **Animation**: GSAP
- **Data Fetching**: GitHub GraphQL API
- **Styling**: Custom pixel art CSS
- **Font**: Press Start 2P (Google Fonts)
- **Automation**: GitHub Actions
- **Hosting**: GitHub Pages

## 📋 Project Structure

```
code-mapper/
├── main.py              # FastAPI application entry point
├── requirements.txt     # Python dependencies
├── .github/workflows/   # GitHub Actions workflow files
├── src/                 # Frontend source code
│   ├── index.html       # Main HTML template
│   ├── static/          # Static assets
│   │   ├── css/         # Stylesheets
│   │   ├── js/          # JavaScript files
│   │   ├── images/      # Pixel art images
├── cache/               # Cached GitHub user data by country
```

## 🔍 Future Enhancements

- Add more countries and detailed data
- Implement animation transitions between countries
- Create a global leaderboard
- Add different map themes (night mode, fantasy style)
- Integrate with GitHub API for real-time data

## 🙏 Acknowledgments

This project builds upon the [Top GitHub Users Action](https://github.com/gayanvoice/top-github-users-action) by Gayan Kuruppu, Thank you for this amazing contribution.

## 📝 License

MIT License

## 👨‍💻 Author

- Adonai Vera (@adonaivera)

