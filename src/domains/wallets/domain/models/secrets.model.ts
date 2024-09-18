import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { SecretsInterface } from "../interfaces/secrets.interface";

@Entity()
export class SecretsModel implements SecretsInterface {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  wallet_id: string;

  @Column({ nullable: true })
  mnemonic: string;

  @Column({ nullable: true })
  private_key: string;

  @Column({ nullable: true })
  public_key: string;

  @Column()
  created_at: string;
}
