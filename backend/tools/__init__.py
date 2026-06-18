"""Claude tool definitions for DataViz Pro.

ALL_TOOLS is the list passed to the Messages API. Order is deliberate and
stable — tool definitions render first in the prompt, so a deterministic
order keeps the prompt cache valid across requests.
"""

from tools.anomaly_tool import DEFINITION as ANOMALY_TOOL
from tools.chart_tool import DEFINITION as CHART_TOOL
from tools.forecast_tool import DEFINITION as FORECAST_TOOL
from tools.pandas_tool import DEFINITION as PANDAS_TOOL
from tools.sql_tool import DEFINITION as SQL_TOOL

ALL_TOOLS = [
    PANDAS_TOOL,
    SQL_TOOL,
    CHART_TOOL,
    FORECAST_TOOL,
    ANOMALY_TOOL,
]

TOOL_NAMES = [t["name"] for t in ALL_TOOLS]
