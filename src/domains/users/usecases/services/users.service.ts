import { DeleteResult, FindManyOptions, Repository, UpdateResult } from "typeorm";
import { UserStatus } from "../../domain/interfaces/user.interface";
import { DB_DATE_FORMAT } from "src/common/consts/date.const";
import { UserModel } from "../../domain/models/user.model";
import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, Logger } from "@nestjs/common";
import * as moment from "moment";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserModel)
    private readonly userRepo: Repository<UserModel>,
  ) {}

  async create(params: Partial<UserModel>): Promise<UserModel | null> {
    try {
      const user = await this.userRepo.save({
        ...params,
        created_at: moment().format(DB_DATE_FORMAT),
      });
      this.logger.log(`User created: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Error creating user: ${error.message}`, error.stack);
      return null;
    }
  }

  async findOne(params: Partial<UserModel>): Promise<UserModel | null> {
    try {
      const user = await this.userRepo.findOneBy(params);
      if (user) {
        this.logger.log(`User found: ${user.id}`);
      } else {
        this.logger.warn(`User not found: ${JSON.stringify(params)}`);
      }
      return user;
    } catch (error) {
      this.logger.error(`Error finding user: ${error.message}`, error.stack);
      return null;
    }
  }

  async findAll(params: FindManyOptions<UserModel>): Promise<UserModel[]> {
    try {
      const users = await this.userRepo.find(params);
      this.logger.log(`Found ${users.length} users`);
      return users;
    } catch (error) {
      this.logger.error(`Error finding users: ${error.message}`, error.stack);
      return [];
    }
  }

  async updateOne({ id, ...params }: Partial<UserModel>): Promise<UpdateResult> {
    try {
      const result = await this.userRepo.update({ id }, params);
      this.logger.log(`User updated: ${id}, affected: ${result.affected}`);
      return result;
    } catch (error) {
      this.logger.error(`Error updating user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async isUserExist(params: Partial<UserModel>): Promise<boolean> {
    try {
      const exists = await this.userRepo.existsBy(params);
      this.logger.log(`User exists check: ${exists}, params: ${JSON.stringify(params)}`);
      return exists;
    } catch (error) {
      this.logger.error(`Error checking user existence: ${error.message}`, error.stack);
      return false;
    }
  }

  async deleteOne(id: string): Promise<DeleteResult> {
    try {
      const result = await this.userRepo.delete({ id });
      this.logger.log(`User deleted: ${id}, affected: ${result.affected}`);
      return result;
    } catch (error) {
      this.logger.error(`Error deleting user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async banUser(id: string) {
    try {
      const result = await this.updateOne({ id, status: UserStatus.BANNED });
      this.logger.log(`User banned: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error banning user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async unbanUser(id: string) {
    try {
      const result = await this.updateOne({ id, status: UserStatus.ACTIVE });
      this.logger.log(`User unbanned: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error unbanning user: ${error.message}`, error.stack);
      throw error;
    }
  }
}