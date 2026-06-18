"""run_sql_query — run DuckDB SQL against the session df."""

DEFINITION = {
    "name": "run_sql_query",
    "description": (
        "Run a SQL query on the user's data using DuckDB. The table is called `df`. "
        "Call this for complex aggregations, window functions, percentiles, or whenever "
        "SQL is cleaner than Pandas for the question being asked."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": (
                    "Valid DuckDB SQL query. The table name is always `df`. Example: "
                    "SELECT region, SUM(revenue) AS total_revenue FROM df "
                    "GROUP BY region ORDER BY total_revenue DESC"
                ),
            },
            "description": {
                "type": "string",
                "description": (
                    "One sentence describing what this query computes, shown to the user "
                    "while it runs."
                ),
            },
        },
        "required": ["sql", "description"],
    },
}
