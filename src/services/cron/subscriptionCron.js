import cron from "node-cron";
import {
  expireSubscriptionsService,
  revokePremiumUsersService,
} from "../../services/Users/subscriptionService.js";

cron.schedule("0 0 * * *", async () => {
  try {
    const count = await expireSubscriptionsService();

    if (count > 0) {
      console.log(`Expired: ${count}`);
    }

    await revokePremiumUsersService();
  } catch (err) {
    console.error("Cron error:", err.message);
  }
});
