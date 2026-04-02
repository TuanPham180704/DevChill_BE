import cron from "node-cron";
import { autoUnlockUsers } from "../../services/Admin/userAdServices.js";

cron.schedule("0 0 * * *", async () => {
  try {
    console.log("⏳ Running auto unlock cron...");

    const unlockedUsers = await autoUnlockUsers();

    if (unlockedUsers.length > 0) {
      console.log(" Auto unlocked users:", unlockedUsers);
    } else {
      console.log(" No users to unlock");
    }
  } catch (err) {
    console.error(" Error in unlock cron:", err);
  }
});
