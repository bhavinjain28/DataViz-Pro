"""run_dataframe_query — execute a Pandas expression against the session df."""

DEFINITION = {
    "name": "run_dataframe_query",
    "description": (
        "Execute a Pandas operation on the user's dataframe to answer a question. "
        "Call this whenever you need actual numbers: aggregations, groupbys, filters, "
        "rankings, comparisons, or any calculation on the real data. The dataframe is "
        "available as `df`. Return the result as a readable string."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": (
                    "Python code using `df` (a pandas DataFrame). Must assign the result "
                    "to a `result` variable. Example: result = df.groupby('region')"
                    "['revenue'].sum().sort_values(ascending=False).head(5).to_string()"
                ),
            },
            "description": {
                "type": "string",
                "description": (
                    "One sentence describing what this code computes, shown to the user "
                    "while it runs."
                ),
            },
        },
        "required": ["code", "description"],
    },
}
