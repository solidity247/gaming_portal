"use server";

import { auth } from "@clerk/nextjs/server";

const AD_REWARD_COINS = 100;

export async function claimCoinsForAdds(userId: number) {
  // 1) update DB (atomic increment)
  // await db.user.update({
  //   where: { id: userId },
  //   data: { balance: { increment: AD_REWARD_COINS } },
  // });
  // 2) invalidate only this user's balance fetch
}

export async function getBalance() {
  const { userId } = await auth();
  console.log(userId);
  return 123;
}
