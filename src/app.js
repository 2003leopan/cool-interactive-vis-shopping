// A4 MVP — Customer Behavior Explorer (v2 with 2-row legend under title)
// Chart: Average purchase amount OR Count by Category
// Interaction: dropdown to switch grouping (Gender, Age Group, Season, Shipping Type)
// Animation: transitions on update; Tooltip on hover

// Increased top margin to make space for title + 2-row legend
const margin = { top: 84, right: 24, bottom: 64, left: 72 };
const width = 1000 - margin.left - margin.right;
const height = 520 - margin.top - margin.bottom;

const svg = d3.select("#chart").append("svg")
  .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");

const x = d3.scaleBand().padding(0.2);
const y = d3.scaleLinear();
const color = d3.scaleOrdinal().range(d3.schemeTableau10);

const xAxisG = svg.append("g").attr("class", "axis x").attr("transform", `translate(0,${height})`);
const yAxisG = svg.append("g").attr("class", "axis y");

// Title
svg.append("text")
  .attr("class", "title")
  .attr("x", 0)
  .attr("y", -36)
  .text("Average Purchase Amount by Category");

// Legend container (now under the title, full width)
const legendG = svg.append("g")
  .attr("class", "legend")
  .attr("transform", `translate(0, -12)`); // a little under the title

// Load data
d3.csv("data/shopping_behavior_updated.csv").then(raw => {
  // Extract relevant fields
  const data = raw.map(d => ({
    category: d["Category"],
    gender: d["Gender"],
    amount: +d["Purchase Amount (USD)"],
    age: +d["Age"],
    season: d["Season"],
    shipping: d["Shipping Type"],
    subscription: d["Subscription Status"],
    discount: d["Discount Applied"],
    previous: +d["Previous Purchases"],
    frequency: d["Frequency of Purchases"]
  })).filter(d => d.category && !Number.isNaN(d.amount));

  // Age binning for clarity
  const ageGroup = (a) => {
    if (a < 18) return "<18";
    if (a < 25) return "18–24";
    if (a < 35) return "25–34";
    if (a < 45) return "35–44";
    if (a < 55) return "45–54";
    if (a < 65) return "55–64";
    return "65+";
  };
  data.forEach(d => d.ageGroup = ageGroup(d.age));

  // UI state
  let filterDim = "Gender"; // "Gender" | "Age Group" | "Season" | "Shipping Type"
  let valueType = "avg";    // "avg" | "count"
  let seasonFilter = "All"; // "All" | "Winter" | "Spring" | "Summer" | "Fall"
  let sortMode = "alpha";
  let viewMode = "overview";


  const filterSelect = document.getElementById("filterSelect");
  const valueSelect  = document.getElementById("valueSelect");
  const scrub = d3.select("#seasonScrubber");
  const sortSelect = document.getElementById("sortSelect");
  const viewSelect = document.getElementById("viewSelect");
  
  
  viewSelect.addEventListener("change", () => {
    viewMode = viewSelect.value;
    if (viewMode === "overview") {
      d3.select("#chart2").style("display","none");
      d3.select("#chart").style("display","block");
      update();
    } else {
      d3.select("#chart").style("display","none");
      d3.select("#chart2").style("display","block");
      renderLoyalty();
    }
  });

  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    update();
  });

  scrub.selectAll("button").on("click", (evt) => {
    seasonFilter = evt.currentTarget.dataset.season;     // update state
    scrub.selectAll("button").classed("on", false);      // toggle active
    d3.select(evt.currentTarget).classed("on", true);
    update();                                            // re-render
    if (viewMode === "loyalty") renderLoyalty();
  });

  filterSelect.addEventListener("change", () => {
    filterDim = filterSelect.value;
    update();
  });
  valueSelect.addEventListener("change", () => {
    valueType = valueSelect.value;
    update();
  });

  // Helper: current grouping key
  function groupKey(d) {
    if (filterDim === "Gender") return d.gender;
    if (filterDim === "Age Group") return d.ageGroup;
    if (filterDim === "Season") return d.season;
    if (filterDim === "Shipping Type") return d.shipping;
    if (filterDim === "Subscription Status") return d.subscription;
    if (filterDim === "Discount Applied") return d.discount;
    return "Other";
  }

  // Stable ordering for Season (Winter→Spring→Summer→Fall)
  const seasonOrder = new Map([["Winter", 0], ["Spring", 1], ["Summer", 2], ["Fall", 3]]);
  function orderedGroups(groups) {
    if (filterDim === "Season") {
      return groups
        .filter(g => seasonOrder.has(g))
        .sort((a, b) => seasonOrder.get(a) - seasonOrder.get(b));
    }
    // Otherwise alphabetical
    return groups.slice().sort(d3.ascending);
  }

  function groupAndAggregate() {
    // rollups by (category, currentGroup)
    const filtered = (seasonFilter === "All")
      ? data
      : data.filter(d => d.season === seasonFilter);

    const rolled = d3.rollups(
      filtered,                           // <-- use filtered, not data
      v => ({
        avg: d3.mean(v, d => d.amount),
        count: v.length,
        category: v[0].category,
        group: groupKey(v[0])
      }),
      d => `${d.category}|||${groupKey(d)}`
    ).map(([_, val]) => val);

    const groupValues = Array.from(new Set(rolled.map(d => d.group)));
    const groups = orderedGroups(groupValues);

    // Per-category values in the same group order
    const byCategory = d3.groups(rolled, d => d.category).map(([cat, vals]) => {
      const lookup = new Map(vals.map(x => [x.group, x]));
      return {
        category: cat,
        values: groups.map(g => {
          const row = lookup.get(g);
          return {
            group: g,
            value: row ? (valueType === "avg" ? row.avg : row.count) : 0
          };
        })
      };
    });

    return { byCategory, groups };
  }


  function update() {
    const { byCategory, groups } = groupAndAggregate();

    // ----- sort categories before scaling -----
    const categoryMetric = d => d3.mean(d.values, v => v.value) ?? 0;

    const catsSorted = (sortMode === "alpha")
      ? byCategory.slice().sort((a, b) => d3.ascending(a.category, b.category))
      : byCategory.slice().sort((a, b) => d3.descending(categoryMetric(a), categoryMetric(b)));

    // index map for staggered animation (category left→right)
    const catIndex = new Map(catsSorted.map((d, i) => [d.category, i]));

    // Scales
    x.domain(catsSorted.map(d => d.category)).range([0, width]);
    const maxY = d3.max(catsSorted, d => d3.max(d.values, v => v.value)) || 0;
    y.domain([0, maxY * 1.1]).range([height, 0]);
    color.domain(groups);

    // Axes
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat(d => valueType === "avg" ? `$${d.toFixed(0)}` : d);

    xAxisG.transition().duration(600).ease(d3.easeCubicOut).call(xAxis)
      .selectAll("text").style("text-anchor", "end").attr("transform", "rotate(-30)");
    yAxisG.transition().duration(600).ease(d3.easeCubicOut).call(yAxis);

    // Category groups (IMPORTANT: bind catsSorted, not byCategory)
    const catG = svg.selectAll(".barG").data(catsSorted, d => d.category);

    const catEnter = catG.enter().append("g")
      .attr("class", "barG")
      .attr("transform", d => `translate(${x(d.category)},0)`);

    catEnter.merge(catG).transition().duration(600).ease(d3.easeCubicOut)
      .attr("transform", d => `translate(${x(d.category)},0)`);

    catG.exit().remove();

    // Inner band per current groups
    const xg = d3.scaleBand().domain(groups).range([0, x.bandwidth()]).padding(0.12);

    // Bars (attach indices so we can stagger delays)
    const bars = catEnter.merge(catG).selectAll("rect").data(
      d => d.values.map((v, gi) => Object.assign(
        { _cat: d.category, _catIndex: catIndex.get(d.category), _groupIndex: gi },
        v
      )),
      v => `${v.group}|${v._cat}` // stable key across resorting
    );

    const tIn = 800;
    const dtCat = 120;   // delay per category
    const dtGroup = 60;  // delay per subgroup within a category

    bars.enter().append("rect")
      .attr("x", v => xg(v.group))
      .attr("width", xg.bandwidth())
      .attr("y", y(0))
      .attr("height", 0)
      .attr("fill", v => color(v.group))
      .on("mousemove", (event, v) => {
        tooltip
          .style("opacity", 1)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 24) + "px")
          .html(`<strong>${filterDim}:</strong> ${v.group}<br>
                <strong>${valueType === "avg" ? "Avg" : "Count"}:</strong> ${valueType === "avg" ? "$" + v.value.toFixed(2) : v.value}`);
      })
      .on("mouseleave", () => tooltip.style("opacity", 0))
      .merge(bars)
      .transition()
      .duration(tIn)
      .ease(d3.easeCubicOut)
      .delay(v => v._catIndex * dtCat + v._groupIndex * dtGroup) // cascading L→R
      .attr("x", v => xg(v.group))
      .attr("width", xg.bandwidth())
      .attr("y", v => y(v.value))
      .attr("height", v => y(0) - y(v.value))
      .attr("fill", v => color(v.group));

    bars.exit()
      .transition().duration(400).ease(d3.easeCubicIn)
      .attr("y", y(0))
      .attr("height", 0)
      .remove();

    // ===== Legend (two fixed rows under the title) =====
    const mid = Math.ceil(groups.length / 2);
    const twoRow = groups.map((g, i) => ({
      label: g,
      row: i < mid ? 0 : 1,
      col: i < mid ? i : (i - mid)
    }));

    const colSpacing = 110;
    const rowY = r => (r === 0 ? 0 : 22);

    const legItems = legendG.selectAll("g.legend-item").data(twoRow, d => d.label);
    const legEnter = legItems.enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", d => `translate(${d.col * colSpacing}, ${rowY(d.row)})`);

    legEnter.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("y", -10)
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("fill", d => color(d.label));

    legEnter.append("text")
      .attr("x", 18)
      .attr("y", 0)
      .attr("dy", "-0.1em")
      .style("font-size", "12px")
      .style("fill", "#cbd5e1")
      .text(d => d.label);

    legItems.merge(legEnter)
      .transition().duration(400).ease(d3.easeCubicOut)
      .attr("transform", d => `translate(${d.col * colSpacing}, ${rowY(d.row)})`)
      .select("rect")
      .attr("fill", d => color(d.label));

    legItems.exit().remove();

    // Title
    const seasonSuffix = seasonFilter === "All" ? "" : ` (${seasonFilter})`;
    const sortSuffix = (sortMode === "value_desc")
      ? ` — sorted by Highest ${valueType === "avg" ? "Average Spend" : "Count"}`
      : "";
    svg.select(".title").text(
      `${valueType === "avg" ? "Average Purchase Amount" : "Number of Purchases"} by Category — grouped by ${filterDim}${seasonSuffix}${sortSuffix}`
    );
  }

  function renderLoyalty() {
    // Clear and set up a fresh SVG for the loyalty view
    const m = { top: 72, right: 28, bottom: 56, left: 68 };
    const w = 1000 - m.left - m.right;
    const h = 520 - m.top - m.bottom;

    const root = d3.select("#chart2");
    root.selectAll("*").remove();

    const svg2 = root.append("svg")
      .attr("viewBox", `0 0 ${w + m.left + m.right} ${h + m.top + m.bottom}`)
      .append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

    // Apply season filter and keep only finite points
    const filteredAll = (seasonFilter === "All") ? data : data.filter(d => d.season === seasonFilter);
    const filtered = filteredAll
      .map(d => ({
        ...d,
        // defensively coerce & trim
        subscription: (d.subscription || "").trim(),
        frequency: (d.frequency || "").trim()
      }))
      .filter(d => Number.isFinite(d.previous) && Number.isFinite(d.amount));

    // Early message if nothing to plot
    if (filtered.length === 0) {
      svg2.append("text")
        .attr("x", 0).attr("y", 0)
        .attr("dy", "1em")
        .style("fill", "#cbd5e1")
        .text("No data points to display for this selection.");
      return;
    }

    // Scales
    const x = d3.scaleLinear()
      .domain([0, d3.max(filtered, d => d.previous) || 1]).nice()
      .range([0, w]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(filtered, d => d.amount) || 1]).nice()
      .range([h, 0]);

    // Color by Subscription (fallback to 'No' if unexpected)
    const col = d3.scaleOrdinal()
      .domain(["Yes","No"])
      .range(d3.schemeTableau10);

    const getSub = s => (s === "Yes" || s === "No") ? s : "No";

    // Size by frequency with a safe fallback
    const freqOrder = ["Weekly","Fortnightly","Monthly","Quarterly","Annually"];
    const size = d3.scaleOrdinal()
      .domain(freqOrder)
      .range([5,5,5,5,5]);
    const rOf = f => size.domain().includes(f) ? size(f) : 5;

    // Axes
    svg2.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x));
    svg2.append("g").call(d3.axisLeft(y));

    svg2.append("text")
      .attr("class", "title")
      .attr("x", 0)
      .attr("y", -32)
      .text(`Loyalty View — Spend vs Previous Purchases${seasonFilter === "All" ? "" : ` (${seasonFilter})`}`);

    // Points with subtle entrance animation
    const pts = svg2.selectAll("circle").data(filtered, (d,i) => i);

    pts.enter().append("circle")
      .attr("cx", d => x(d.previous))
      .attr("cy", y(0))
      .attr("r", d => rOf(d.frequency))
      .attr("fill", d => col(getSub(d.subscription)))
      .attr("opacity", 0.10)
      .on("mousemove", (evt, d) => {
        tooltip.style("opacity",1)
        .style("transition", "opacity 0.15s ease")
          .style("left", (evt.pageX + 12) + "px")
          .style("top", (evt.pageY - 24) + "px")
          .html(`
            <div style="font-size:13px; line-height:1.4;">
              🛒 <strong>Previous Purchases:</strong> ${d.previous}<br/>
              💵 <strong>Spend:</strong> $${d.amount.toFixed(2)}<br/>
              ⭐ <strong>Subscription:</strong> ${d.subscription === "Yes" ? "Member ✅" : "No ❌"}<br/>
              ⏱️ <strong>Frequency:</strong> ${d.frequency || "—"}<br/>
              🏷️ <strong>Category:</strong> ${d.category}
            </div>`
          );
      })
      .on("mouseleave", () => tooltip.style("opacity",0).style("transition", "opacity 0.15s ease"))
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr("cy", d => y(d.amount))
      .attr("opacity", 0.85);

    // Simple legend for Subscription
    const legend = svg2.append("g").attr("transform", `translate(${w - 160}, -10)`);
    ["Yes", "No"].forEach((lab, i) => {
      const g = legend.append("g").attr("transform", `translate(${i*70},0)`);
      g.append("circle").attr("r",6).attr("cy",-6).attr("fill", col(lab));
      g.append("text").attr("x", 12).attr("dy", "-0.2em").text(lab).style("font-size","12px").style("fill","#cbd5e1");
    });

    // Axis labels
    svg2.append("text")
      .attr("x", w/2).attr("y", h + 40)
      .attr("text-anchor", "middle")
      .style("fill", "#cbd5e1")
      .text("Previous Purchases");

    svg2.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -h/2).attr("y", -48)
      .attr("text-anchor", "middle")
      .style("fill", "#cbd5e1")
      .text("Purchase Amount (USD)");
  }

// After defining update() and renderLoyalty(), run initial draw
  // Initial render
  update();
  }).catch(err => {
    console.error("Failed to load CSV:", err);
    d3.select("#chart").append("p").text("Failed to load data.");
  });
