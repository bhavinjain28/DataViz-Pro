"""run_forecast — Prophet time-series forecast on a date + numeric column."""

DEFINITION = {
    "name": "run_forecast",
    "description": (
        "Run a time series forecast using Prophet. Call this when the user asks for "
        "predictions, forecasts, projections, or future trends. Requires a date column "
        "and a numeric column from the dataset. Returns historical + forecast data with "
        "confidence intervals; the frontend renders it as a forecast chart."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "date_column": {
                "type": "string",
                "description": "Column containing dates.",
            },
            "value_column": {
                "type": "string",
                "description": "Numeric column to forecast.",
            },
            "periods": {
                "type": "integer",
                "description": "Number of future periods to forecast (days).",
                "default": 30,
            },
            "title": {
                "type": "string",
                "description": "Title for the forecast chart.",
            },
        },
        "required": ["date_column", "value_column", "periods", "title"],
    },
}
