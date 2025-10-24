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

## File layout
```
index.html       # Main page, loads D3 and app.js
styles.css       # Styling
src/app.js       # D3 chart logic
data/...csv      # Dataset
```
