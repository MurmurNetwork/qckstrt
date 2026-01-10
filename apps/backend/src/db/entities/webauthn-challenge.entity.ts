import {
  Entity,
  PrimaryColumn,
  Column,
  BaseEntity,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Temporary storage for WebAuthn challenges.
 * Challenges are single-use and expire after 5 minutes.
 */
@Entity('webauthn_challenges')
@Index('idx_webauthn_challenges_lookup', ['identifier', 'type'])
export class WebAuthnChallengeEntity extends BaseEntity {
  // Email address or anonymous session identifier
  @PrimaryColumn({ type: 'varchar', length: 255 })
  public identifier!: string;

  // The cryptographic challenge (base64url encoded)
  @Column({ type: 'text' })
  public challenge!: string;

  // Type of WebAuthn operation
  @Column({ type: 'varchar', length: 20 })
  public type!: 'registration' | 'authentication';

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;

  @Column({ type: 'timestamptz' })
  @Index()
  public expiresAt!: Date;
}
