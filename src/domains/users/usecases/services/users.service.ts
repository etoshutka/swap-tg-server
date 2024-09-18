import { DeleteResult, FindManyOptions, Repository, UpdateResult } from "typeorm";
import { UserStatus } from "../../domain/interfaces/user.interface";
import { DB_DATE_FORMAT } from "src/common/consts/date.const";
import { UserModel } from "../../domain/models/user.model";
import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import * as moment from "moment";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserModel)
    private readonly userRepo: Repository<UserModel>,
  ) {}

  /**
   * Create new user
   * @param {Partial<UserModel>} params
   * @returns {Promise<UserModel | null>}
   */
  async create(params: Partial<UserModel>): Promise<UserModel | null> {
    return await this.userRepo.save({
      ...params,
      created_at: moment().format(DB_DATE_FORMAT),
    });
  }

  /**
   * Find user
   * @param {Partial<UserModel>} params
   * @returns {Promise<UserModel | null>}
   */
  async findOne(params: Partial<UserModel>): Promise<UserModel | null> {
    return await this.userRepo.findOneBy(params);
  }

  /**
   * Find users
   * @param {FindManyOptions<UserModel>} params
   * @returns {Promise<UserModel[]>}
   */
  async findAll(params: FindManyOptions<UserModel>): Promise<UserModel[]> {
    return await this.userRepo.find(params);
  }

  /**
   * Update user
   * @param {string} id
   * @param {Partial<UserModel>} params
   * @returns {Promise<UserModel | null>}
   */
  async updateOne({ id, ...params }: Partial<UserModel>): Promise<UpdateResult> {
    return await this.userRepo.update({ id }, params);
  }

  /**
   * Check if user exist
   * @param {Partial<UserModel>} params
   * @returns {Promise<boolean>}
   */
  async isUserExist(params: Partial<UserModel>): Promise<boolean> {
    return await this.userRepo.existsBy(params);
  }

  /**
   * Delete user
   * @param {string} id
   * @returns {Promise<DeleteResult>}
   */
  async deleteOne(id: string): Promise<DeleteResult> {
    return await this.userRepo.delete({ id });
  }

  /**
   * Ban user
   * @param {string} id
   * @returns {Promise<UpdateResult>}
   */
  async banUser(id: string) {
    return await this.updateOne({ id, status: UserStatus.BANNED });
  }

  /**
   * Unban user
   * @param {string} id
   * @returns {Promise<UpdateResult>}
   */
  async unbanUser(id: string) {
    return await this.updateOne({ id, status: UserStatus.ACTIVE });
  }
}
