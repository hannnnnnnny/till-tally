# Analytics plan contract

`@till-tally/analytics-contracts` is the shared boundary between the natural-language planner, the trusted analytics executor, and the frontend renderer. A planner can only describe a report using this allowlisted contract. It cannot send SQL, table names, expressions, or arbitrary field names.

## Version 1 plan

```json
{
  "schemaVersion": 1,
  "metrics": ["revenue", "grossProfit"],
  "dimensions": ["day"],
  "dateRange": {
    "from": "2026-06-01",
    "to": "2026-06-30",
    "timezone": "Pacific/Auckland"
  },
  "filters": [],
  "sort": [{ "field": "day", "direction": "asc" }],
  "limit": 31,
  "chart": { "type": "line" }
}
```

Every object is strict. Unknown keys, metrics, dimensions, filters, operators, chart types, and timezones are rejected. Date ranges are inclusive and limited to 366 days. Plans can request at most 3 metrics, 2 dimensions, 10 filters, 2 sort rules, 100 result rows, and 20 values in a list filter.

## Canonical metrics

| Metric | Source and aggregation | Unit | Null behaviour |
| --- | --- | --- | --- |
| `revenue` | Sum `OrderItem.totalPrice` | NZD | Missing values excluded; empty result is 0 |
| `grossProfit` | Sum total price minus captured `costPrice` times quantity | NZD | Rows without usable cost excluded |
| `grossMarginPct` | Gross profit divided by revenue, times 100 | Percent | 0 when revenue is 0 |
| `orders` | Distinct `Order.id` count | Orders | Empty result is 0 |
| `averageOrderValue` | Revenue divided by distinct orders | NZD | 0 when there are no orders |
| `unitsSold` | Sum `OrderItem.quantity` | Units | Missing values excluded; empty result is 0 |
| `currentStock` | Sum `Product.currentStock` | Units | Products without imported stock use 0 |
| `lowStockProducts` | Distinct products classified `LOW_STOCK` | Products | Insufficient evidence excluded |
| `stockoutRiskProducts` | Distinct products classified `STOCKOUT_RISK` | Products | Insufficient evidence excluded |
| `reorderSoonProducts` | Distinct products classified `REORDER_SOON` | Products | Insufficient evidence excluded |
| `slowMoverProducts` | Distinct products classified `SLOW_MOVER` | Products | Insufficient sales history excluded |
| `deadStockProducts` | Distinct products classified `DEAD_STOCK` | Products | Insufficient sales history excluded |
| `discountCandidateProducts` | Distinct products classified `DISCOUNT_CANDIDATE` | Products | Insufficient evidence excluded |
| `overstockedProducts` | Distinct products classified `OVERSTOCKED` | Products | Insufficient evidence excluded |

The source strings, aggregation rules, units, null behaviour, labels, and dimension compatibility are also exported in `ANALYTICS_METRIC_CATALOG` so product surfaces can describe metrics without duplicating definitions.

## Dimensions and visual compatibility

- Temporal dimensions: `day`, `week`, `month`.
- Categorical dimensions: `channel`, `product`, `category`, `status`.
- Line charts require exactly one temporal dimension.
- Donut charts require exactly one categorical dimension.
- Bar charts require exactly one compatible dimension.
- Tables support zero, one, or two compatible dimensions.

Sales metrics support the dimensions listed in the catalog. Latest-stock metrics only support product, category, and status. Grouped inventory-risk counts support category and status. A plan is rejected when any selected metric is incompatible with any selected dimension.

## Filters

| Field | Operators |
| --- | --- |
| `channel`, `productId`, `status` | `eq`, `in`, `notIn` |
| `category`, `sku`, `vendor` | `eq`, `in`, `notIn`, `contains` |
| `currentStock` | `eq`, `gte`, `lte` |

`in` and `notIn` require a non-empty list. Stock filters require a non-negative number. Other filters require text. A plan containing an inventory metric cannot use a channel filter.

## Trust boundary

The schema validates shape and semantic compatibility, but does not execute a query. The executor remains responsible for business membership, row-level isolation, parameterised query construction, query timeouts, result-size enforcement, and audit logging. Never interpolate planner output into SQL or ORM raw-query strings.
