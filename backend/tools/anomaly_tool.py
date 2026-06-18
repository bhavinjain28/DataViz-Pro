"""detect_anomalies — IQR + Z-score outlier detection on a numeric column."""

DEFINITION = {
    "name": "detect_anomalies",
    "description": (
        "Detect statistical anomalies and outliers in a numeric column using IQR and "
        "Z-score methods. Call this when the user asks about outliers, anomalies, "
        "unusual values, spikes, or data quality concerns."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "column": {
                "type": "string",
                "description": "Numeric column to analyze.",
            },
            "method": {
                "type": "string",
                "enum": ["iqr", "zscore", "both"],
                "description": "Detection method to use (default both).",
                "default": "both",
            },
        },
        "required": ["column"],
    },
}
