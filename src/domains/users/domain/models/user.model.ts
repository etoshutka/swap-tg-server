import { UserInterface, UserRole, UserStatus } from "../interfaces/user.interface";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class UserModel implements UserInterface {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  telegram_id: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({
    type: "enum",
    enum: UserStatus,
    enumName: "UserStatus",
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({
    type: "enum",
    enum: UserRole,
    enumName: "UserRole",
    default: UserRole.USER,
  })
  role: UserRole;

  @Column()
  language_code: string;

  @Column({ nullable: true })
  csrf_token: string;

  @Column()
  created_at: string;

  @Column({ default: false })
  is_admin: boolean;

  @Column({ default: false })
  is_inactive: boolean;

  @Column({ default: false })
  is_banned: boolean;
}
