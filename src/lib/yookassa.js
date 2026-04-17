import { YookassaSdk } from "@yookassa/sdk";

const sdk = new YookassaSdk({
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY,
});

const paymentsApi = sdk.payments;
const refundsApi = sdk.refunds;

export { paymentsApi, refundsApi };
