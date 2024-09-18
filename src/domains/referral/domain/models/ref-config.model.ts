import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { RefConfigInterface } from "../interfaces/ref-config.interface";

@Entity()
export class RefConfigModel implements RefConfigInterface {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("float")
  level_1_percent: number;

  @Column("float")
  level_2_percent: number;

  @Column("float")
  level_3_percent: number;

  @CreateDateColumn()
  created_at: string;

  @UpdateDateColumn()
  updated_at: string;
}
