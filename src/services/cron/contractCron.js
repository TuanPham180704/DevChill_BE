import cron from "node-cron";
import { autoExpireContracts } from "../../services/Admin/contractService.js";

export const contractCron = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      console.log("⏳ Running auto-expire contracts cron...");
      const expiredContracts = await autoExpireContracts();
      if (expiredContracts.length)
        console.log(
          "Contracts expired:",
          expiredContracts.map((c) => c.id),
        );
      else console.log("No contracts to expire");
    } catch (err) {
      console.error("Error in contract cron:", err);
    }
  });
};
