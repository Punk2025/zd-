import { addEvent, upsertChannel } from "./store";
import { isAdminStatus, type TgChat, type TgUser } from "./telegram";

type ChatMemberUpdated = {
  chat: TgChat;
  new_chat_member?: { status?: string; user?: TgUser };
  old_chat_member?: { status?: string; user?: TgUser };
};

type Update = {
  update_id?: number;
  my_chat_member?: ChatMemberUpdated;
  channel_post?: { chat: TgChat; text?: string };
  message?: { chat: TgChat; text?: string };
};

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

async function channelExists(
  db: D1Database,
  botId: string,
  chatId: string,
): Promise<{ status: string } | null> {
  return (
    (await db
      .prepare(`SELECT status FROM channels WHERE bot_id = ? AND chat_id = ?`)
      .bind(botId, chatId)
      .first<{ status: string }>()) ?? null
  );
}

export async function handleTelegramUpdate(
  db: D1Database,
  bot: { id: string; username: string | null },
  update: Update,
): Promise<void> {
  if (update.my_chat_member) {
    const m = update.my_chat_member;
    const chat = m.chat;
    if (chat.type !== "channel" && chat.type !== "supergroup") return;

    const status = m.new_chat_member?.status || "";
    const chatId = String(chat.id);

    if (status === "left" || status === "kicked") {
      await upsertChannel(db, {
        id: newId(),
        bot_id: bot.id,
        chat_id: chatId,
        title: chat.title || null,
        username: chat.username || null,
        type: chat.type,
        status: "left",
      });
      await addEvent(
        db,
        "unbind",
        `机器人 @${bot.username || "?"} 已离开频道 ${chat.title || chatId}`,
      );
      return;
    }

    if (isAdminStatus(status) || status === "member") {
      const bindStatus = isAdminStatus(status) ? "bound" : "pending";
      await upsertChannel(db, {
        id: newId(),
        bot_id: bot.id,
        chat_id: chatId,
        title: chat.title || null,
        username: chat.username || null,
        type: chat.type,
        status: bindStatus,
      });
      await addEvent(
        db,
        bindStatus === "bound" ? "bind" : "pending",
        bindStatus === "bound"
          ? `已自动绑定频道「${chat.title || chatId}」（管理员权限）→ @${bot.username || "?"}`
          : `频道「${chat.title || chatId}」已加入机器人，但还不是管理员。请勾选「发布消息」`,
      );
    }
    return;
  }

  const post = update.channel_post;
  if (post?.chat) {
    const chat = post.chat;
    const chatId = String(chat.id);
    const existing = await channelExists(db, bot.id, chatId);
    if (existing?.status === "bound") return;

    await upsertChannel(db, {
      id: newId(),
      bot_id: bot.id,
      chat_id: chatId,
      title: chat.title || null,
      username: chat.username || null,
      type: chat.type,
      status: "bound",
    });
    await addEvent(
      db,
      "bind",
      `通过频道消息自动绑定「${chat.title || chat.id}」→ @${bot.username || "?"}`,
    );
  }
}
