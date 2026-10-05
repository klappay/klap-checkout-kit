---
"@klappay/checkout-kit": patch
---

Bumps `@klappay/node` to `^5.1.4`, which treats an empty successful response body (e.g. `202 Accepted`) as `undefined` instead of throwing `Unexpected end of JSON input`. No API change here. The examples also move from `@klappay/node` `^3.3.0` to `^5.1.4`.
