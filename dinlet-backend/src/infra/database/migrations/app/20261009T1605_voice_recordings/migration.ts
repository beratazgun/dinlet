#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b3254be54b7b6f3f1735af5953d10336e6d2f8cd72ef2db8e565fce8f53bd0fd/contract';
import endContract from '../../snapshots/b3254be54b7b6f3f1735af5953d10336e6d2f8cd72ef2db8e565fce8f53bd0fd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ca4c333c1d0e73746d13d0c2fd895277e7961027871b85eb32c7515afa422009/contract';
import startContract from '../../snapshots/ca4c333c1d0e73746d13d0c2fd895277e7961027871b85eb32c7515afa422009/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'recording_clips',
        columns: [
          col('audio_key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('duration_ms', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mime_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('recording_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('size_bytes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'section_recordings',
        columns: [
          col('audio_key', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('duration_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('failure_reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mix_run', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('recap_duration_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('recap_start_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('script_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('section_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('size_bytes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('use_own_voice', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'section_recordings_status_check_7246f521',
            "\"status\" IN ('DRAFT', 'PROCESSING', 'READY', 'FAILED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'voice_settings',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('voice', 'text', {
            notNull: true,
            default: lit('STANDARD'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'voice_settings_voice_check_471d6cac',
            "\"voice\" IN ('STANDARD', 'NATURAL', 'OWN')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'recording_clips',
        constraint: 'recording_clips_recording_id_position_key',
        columns: ['recording_id', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'section_recordings',
        constraint: 'section_recordings_user_id_section_id_key',
        columns: ['user_id', 'section_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'voice_settings',
        constraint: 'voice_settings_user_id_key',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recording_clips',
        index: 'recording_clips_recording_id_idx_065a3de5',
        columns: ['recording_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'section_recordings',
        index: 'section_recordings_section_id_idx_13db6de7',
        columns: ['section_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'section_recordings',
        index: 'section_recordings_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'section_recordings',
        index: 'section_recordings_user_id_updated_at_idx_f41263b4',
        columns: ['user_id', 'updated_at'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recording_clips',
        foreignKey: {
          name: 'recording_clips_recording_id_fkey',
          columns: ['recording_id'],
          references: { schema: 'public', table: 'section_recordings', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'section_recordings',
        foreignKey: {
          name: 'section_recordings_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'section_recordings',
        foreignKey: {
          name: 'section_recordings_section_id_fkey',
          columns: ['section_id'],
          references: { schema: 'public', table: 'sections', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'voice_settings',
        foreignKey: {
          name: 'voice_settings_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
