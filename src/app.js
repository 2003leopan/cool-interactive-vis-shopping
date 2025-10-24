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
    shipping: d["Shipping Type"]
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

  const filterSelect = document.getElementById("filterSelect");
  const valueSelect  = document.getElementById("valueSelect");

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
    const rolled = d3.rollups(
      data,
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

    // Scales
    x.domain(byCategory.map(d => d.category)).range([0, width]);
    const maxY = d3.max(byCategory, d => d3.max(d.values, v => v.value)) || 0;
    y.domain([0, maxY * 1.1]).range([height, 0]);
    color.domain(groups);

    // Axes
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat(d => valueType === "avg" ? `$${d.toFixed(0)}` : d);
    xAxisG.transition().duration(600).call(xAxis)
      .selectAll("text").style("text-anchor", "end").attr("transform", "rotate(-30)");
    yAxisG.transition().duration(600).call(yAxis);

    // Category groups
    const catG = svg.selectAll(".barG").data(byCategory, d => d.category);
    const catEnter = catG.enter().append("g").attr("class", "barG")
      .attr("transform", d => `translate(${x(d.category)},0)`);
    catEnter.merge(catG).transition().duration(600)
      .attr("transform", d => `translate(${x(d.category)},0)`);
    catG.exit().remove();

    // Inner band per current groups
    const xg = d3.scaleBand().domain(groups).range([0, x.bandwidth()]).padding(0.12);

    // Bars
    const bars = catEnter.merge(catG).selectAll("rect").data(d => d.values, v => v.group);

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
      .transition().duration(800)
      .attr("x", v => xg(v.group))
      .attr("width", xg.bandwidth())
      .attr("y", v => y(v.value))
      .attr("height", v => y(0) - y(v.value))
      .attr("fill", v => color(v.group));

    bars.exit().transition().duration(400).attr("y", y(0)).attr("height", 0).remove();

    // ===== Legend (two fixed rows under the title) =====
    // Split the groups into two rows: first half on row 0, remainder on row 1.
    const mid = Math.ceil(groups.length / 2);
    const twoRow = groups.map((g, i) => ({
      label: g,
      row: i < mid ? 0 : 1,
      col: i < mid ? i : (i - mid)
    }));

    const colSpacing = 110; // horizontal spacing between legend items
    const rowY = (r) => (r === 0 ? 0 : 22); // vertical positions for two rows

    const legItems = legendG.selectAll("g.legend-item").data(twoRow, d => d.label);
    const legEnter = legItems.enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", d => `translate(${d.col * colSpacing}, ${rowY(d.row)})`);

    // colored swatch
    legEnter.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("y", -10)
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("fill", d => color(d.label));

    // label
    legEnter.append("text")
      .attr("x", 18)
      .attr("y", 0)
      .attr("dy", "-0.1em")
      .style("font-size", "12px")
      .style("fill", "#cbd5e1")
      .text(d => d.label);

    // update positions/colors for existing items
    legItems.merge(legEnter)
      .transition().duration(400)
      .attr("transform", d => `translate(${d.col * colSpacing}, ${rowY(d.row)})`)
      .select("rect")
      .attr("fill", d => color(d.label));

    legItems.exit().remove();

    // Update title text (avg vs count + current grouping)
    svg.select(".title").text(
      `${valueType === "avg" ? "Average Purchase Amount" : "Number of Purchases"} by Category — grouped by ${filterDim}`
    );
  }

  // Initial render
  update();
}).catch(err => {
  console.error("Failed to load CSV:", err);
  d3.select("#chart").append("p").text("Failed to load data.");
});
