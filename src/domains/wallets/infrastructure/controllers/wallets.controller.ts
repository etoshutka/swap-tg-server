import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import * as serviceTypes from "../../usecases/interfaces/wallets.interface";
import { WalletsService } from "../../usecases/services/wallets.service";
import { AuthGuard } from "src/common/guards/auth.guard";
import { UserModel } from "src/domains/users";
import { Request } from "express";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("wallets")
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @UseGuards(AuthGuard)
  @Get("wallet/:id")
  async getWallet(@Param() params: serviceTypes.GetWalletParams) {
    const result = await this.walletsService.getWallet(params);
    if (!result.ok) throw new HttpException(result.message, result.status);
    return result;
  }

  @UseGuards(AuthGuard)
  @Get("list")
  async getWallets(@Req() req: Request & { user?: UserModel }) {
    console.log('WalletsController: Request user:', req.user);
    if (!req.user || !req.user.id) {
      throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    const result = await this.walletsService.getWallets({ user_id: req.user.id });
    
    // if (!result.ok) {
    //   console.error('Error in getWallets:', result);
    //   throw new HttpException(result.message || 'Internal server error', result.status || HttpStatus.INTERNAL_SERVER_ERROR);
    // }
    
    return result;
  }

  @UseGuards(AuthGuard)
  @Get("token/info")
  async getTokenInfo(@Query() params: serviceTypes.GetTokenInfoParams) {
    const result = await this.walletsService.getTokenInfo(params);
    if (!result.ok) throw new HttpException(result.message, result.status);
    return result;
  }

  // @UseGuards(AuthGuard)
  @Get("token/price")
  async getTokenPrice(@Query() params: serviceTypes.GetTokenPriceParams) {
    const result = await this.walletsService.getTokenPrice(params);
    if (!result.ok) throw new HttpException(result.message, result.status);
    return result;
  }

  // @UseGuards(AuthGuard)
  @Post("token/add")
  async getWalletToken(@Body() body: serviceTypes.AddWalletTokenParams) {
    const result = await this.walletsService.addWalletToken(body);
    if (!result.ok) throw new HttpException(result.message, result.status);
    return result;
  }

  // @UseGuards(AuthGuard)
  @Post("create")
  async createWallet(@Body() body: serviceTypes.GenerateWalletParams, @Req() req: Request & { user: UserModel }) {
    const result = await this.walletsService.generateWallet({ ...body, user_id: req.user.id });
    if (!result.ok) throw new HttpException(result.message, result.status);
    return result;
  }

  // @UseGuards(AuthGuard)
  @Post("import")
  async importWallet(@Body() body: serviceTypes.ImportWalletParams, @Req() req: Request & { user: UserModel }) {
    const result = await this.walletsService.importWallet({ ...body, user_id: req.user.id });
    if (!result.ok) throw new HttpException(result.message, result.status);
    return result;
  }

  // @UseGuards(AuthGuard)
  @Delete("delete")
  async deleteWallet(@Body() body: serviceTypes.DeleteWalletParams) {
    const result = await this.walletsService.deleteWallet(body);
    if (!result.ok) throw new HttpException(result.message, result.status);
    return result;
  }

  // @UseGuards(AuthGuard)
  @Post("transfer")
  async transferTransaction(@Body() body: serviceTypes.TransferTransactionParams) {
    const result = await this.walletsService.transferTransaction(body);
    if (!result.ok) throw new HttpException(result.message, result.status);
    return result;
  }

  // @UseGuards(AuthGuard)
  @Get("transactions")
  async getWalletTransactions(@Query() query: serviceTypes.GetWalletTransactionsParams) {
    const result = await this.walletsService.getWalletTransactions(query);
    if (!result.ok) throw new HttpException(result.message, result.status);
    return result;
  }
}
