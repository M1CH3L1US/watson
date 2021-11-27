import { Injectable } from '@common/decorators';
import { ExtendReadonlyCtor } from '@common/utils';
import { Channel, Guild, Message, VoiceChannel } from 'discord.js';

/**
 * Injects the channel that the
 * event was emitted from.
 */
@Injectable({ providedIn: "ctx" })
export abstract class ChannelCtx extends Channel {}

/**
 * Injects the voice channel
 * that the user, who has used the command
 * is in.
 */
@Injectable({ providedIn: "ctx" })
export abstract class VoiceChannelCtx extends VoiceChannel {}

/**
 * Injects the message that emitted
 * the event
 */
@Injectable({ providedIn: "ctx" })
export abstract class MessageCtx extends ExtendReadonlyCtor(Message) {}

/**
 * Injects the discord client from
 * which the event was emitted.
 *
 * Will be `null` if the event wasn't
 * emitted from a guild.
 */
@Injectable({ providedIn: "ctx" })
export abstract class GuildCtx extends ExtendReadonlyCtor(Guild) {}
