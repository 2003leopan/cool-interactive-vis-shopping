# A4 MVP — Customer Behavior Explorer

**What this MVP demonstrates**
- D3.js bar chart of *Average Purchase Amount by Category*
- Dropdown to switch grouping: **Gender** or **Age Group**
- Animated transitions on update
- Tooltip details-on-demand
- Clean structure for quick iteration

## Run locally
Just open `index.html` with a local server (due to browser CSV loading rules).
For example with Python 3 from the project root:
```bash
python -m http.server 8080
# then visit http://localhost:8080
```

## Deploy to GitHub Pages (recommended structure)
1. Create a new repo, e.g., `a4-mvp-customer-viz`.
2. Upload these files, preserving folders:
```
/data/shopping_behavior_updated.csv
/src/app.js
index.html
styles.css
README.md
```
3. In GitHub → **Settings → Pages** → **Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **main** (root)
4. Wait for GH Pages to build, then open the provided URL.

## File layout
```
index.html       # Main page, loads D3 and app.js
styles.css       # Styling
src/app.js       # D3 chart logic
data/...csv      # Dataset
```

## Next steps (post-MVP)
- Add Season slider for seasonality
- Add Subscription/Loyalty view (frequency, subscription status)
- Geography breakdown (state-wise)
- Narrative annotations for spikes
