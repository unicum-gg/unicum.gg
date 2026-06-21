// Discord interaction protocol primitives.
// Reference: https://discord.com/developers/docs/interactions/receiving-and-responding

export enum InteractionType {
  Ping = 1,
  ApplicationCommand = 2,
  MessageComponent = 3,
  ApplicationCommandAutocomplete = 4,
  ModalSubmit = 5,
}

export enum InteractionResponseType {
  Pong = 1,
  ChannelMessageWithSource = 4,
  DeferredChannelMessageWithSource = 5,
}

export enum ApplicationCommandOptionType {
  SubCommand = 1,
  SubCommandGroup = 2,
  String = 3,
  Integer = 4,
  Boolean = 5,
  User = 6,
  Channel = 7,
}

export enum MessageFlags {
  Ephemeral = 64,
}

export type InteractionOption = {
  name: string;
  type: ApplicationCommandOptionType;
  value?: string | number | boolean;
  options?: InteractionOption[];
};

export type InteractionData = {
  id: string;
  name: string;
  options?: InteractionOption[];
};

export type Interaction = {
  id: string;
  type: InteractionType;
  // Present on APPLICATION_COMMAND. The token is valid for 15 minutes and is
  // what we use to edit the deferred response via the webhook follow-up route.
  token: string;
  application_id: string;
  data?: InteractionData;
  guild_id?: string;
  channel_id?: string;
};

export type EmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type Embed = {
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
};

export type MessagePayload = {
  content?: string;
  embeds?: Embed[];
  flags?: number;
};

// Brand color for embeds (unicum.gg accent).
export const BRAND_COLOR = 0x4ade80;
