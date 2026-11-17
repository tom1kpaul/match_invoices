## Project rules

- Payment-matching logic (CSV parsing, matching, statuses) lives as pure functions in `src/lib/matching.ts` with amounts as integer haléře; UI components only render its results — keeps the business rules testable and free of float rounding errors.
