import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ReferralInterface } from "../interfaces/referral.interface";

@Entity()
export class ReferralModel implements ReferralInterface {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  user_id: string;

  @Column()
  telegram_id: string;

  @Column()
  link: string;

  @Column("float")
  invited_count: number;

  @Column("float")
  balance: number;

  @Column({ nullable: true })
  invited_by: string;

  @CreateDateColumn()
  created_at: string;

  @UpdateDateColumn()
  updated_at: string;
}
