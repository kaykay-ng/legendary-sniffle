# Group Assignment - Network Analysis & Visualization

A collaborative project for analyzing and visualizing unweighted directed graph networks using Jupyter notebooks and interactive GitHub Pages visualization.

## Project Structure

```
group-assignment/
├── data/                  # TSV data files
├── notebooks/             # Jupyter notebooks for analysis
│   └── analysis.ipynb     # Main network analysis notebook
├── docs/                  # GitHub Pages (published at your-username.github.io/group-assignment)
│   ├── index.html         # Main visualization page
│   ├── css/
│   │   └── style.css      # Styling
│   ├── js/
│   │   └── visualization.js # Network visualization (Cytoscape.js)
│   └── data/
│       └── network.json   # Network data file
├── venv/                  # Python virtual environment
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

## Setup

### 1. Activate Virtual Environment

```bash
cd group-assignment
source venv/bin/activate
```

### 2. Install Dependencies (if needed)

```bash
pip install -r requirements.txt
```

## Usage

### Option A: Jupyter Notebook Analysis

```bash
jupyter notebook notebooks/analysis.ipynb
```

**Workflow:**
1. Load your TSV data using the notebook
2. Create and analyze the directed graph
3. Generate statistics and visualizations
4. Export network to JSON format for web visualization

### Option B: GitHub Pages Visualization

1. **Local testing:**
   - Open `docs/index.html` in your browser
   - Upload a TSV or JSON file

2. **After pushing to GitHub:**
   - Go to repo Settings → Pages
   - Set source to "Deploy from a branch" → `main` branch → `docs` folder
   - Your site will be published at: `https://your-username.github.io/group-assignment/`

## Data Format

### TSV Format
Place `.tsv` files in the `data/` folder:
```
source	target
0	1
0	2
1	3
```

### JSON Format
For direct web visualization:
```json
{
  "nodes": [
    {"id": "0"},
    {"id": "1"}
  ],
  "edges": [
    {"source": "0", "target": "1"}
  ]
}
```

## Workflow

1. **Analyze**: Use Jupyter notebook (`notebooks/analysis.ipynb`) to analyze your network
2. **Export**: Export the graph as JSON from the notebook
3. **Visualize**: Upload JSON to the GitHub Pages site or place it in `docs/data/network.json`
4. **Present**: Share the GitHub Pages link with your collaborator

## Features

### Notebook Features
- Load TSV data
- Calculate network statistics
- Compute in-degree and out-degree
- Generate JSON export

### Visualization Features
- Interactive network graph
- Multiple layout algorithms (cose, grid, circle, etc.)
- Node highlighting and connection visualization
- Network statistics display
- File upload (TSV/JSON)
- Pan, zoom, and reset controls

## GitHub Setup

After creating this repo on GitHub:

```bash
# Add remote
git remote add origin https://github.com/your-username/group-assignment.git

# Initial commit
git add .
git commit -m "Initial project setup"

# Push to GitHub
git branch -M main
git push -u origin main
```

## Invite Collaborator

1. Go to GitHub repo Settings → Collaborators
2. Click "Add people"
3. Enter your collaborator's GitHub username
4. They'll receive an invitation

## Technologies Used

- **Backend Analysis**: Python, NetworkX, Pandas
- **Frontend Visualization**: JavaScript, Cytoscape.js
- **Data Format**: JSON, TSV
- **Hosting**: GitHub Pages
- **Environment**: Python 3, Jupyter

## Notes

- Commit your analysis notebooks regularly
- Document findings in notebooks
- Keep `docs/data/network.json` updated for GitHub Pages
- Use meaningful commit messages
- Test visualization locally before pushing
