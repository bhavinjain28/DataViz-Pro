"""generate_chart_data — aggregate data into a Recharts-ready payload."""

DEFINITION = {
    "name": "generate_chart_data",
    "description": (
        "Generate chart data to visualize an answer. Call this when the user asks for a "
        "chart, graph, plot, or visualization, or when a visual would significantly aid "
        "understanding of a comparison, trend, or composition. Returns data formatted "
        "for Recharts; the frontend adds it to the user's dashboard."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "chart_type": {
                "type": "string",
                "enum": ["bar", "line", "area", "pie", "scatter"],
                "description": (
                    "Chart type. Use bar for comparisons, line/area for trends over "
                    "time, pie for composition, scatter for correlations."
                ),
            },
            "x_column": {
                "type": "string",
                "description": "Column for the X axis or categories.",
            },
            "y_column": {
                "type": "string",
                "description": "Numeric column for the Y axis or values.",
            },
            "aggregation": {
                "type": "string",
                "enum": ["sum", "mean", "count", "max", "min"],
                "description": "How to aggregate y_column by x_column.",
            },
            "title": {
                "type": "string",
                "description": "Chart title shown on the dashboard card.",
            },
            "limit": {
                "type": "integer",
                "description": "Max number of data points (default 20).",
                "default": 20,
            },
        },
        "required": ["chart_type", "x_column", "y_column", "aggregation", "title"],
    },
}
