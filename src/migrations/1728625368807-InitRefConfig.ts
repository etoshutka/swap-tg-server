import { MigrationInterface, QueryRunner } from "typeorm";

export class InitRefConfigData1728625368807 implements MigrationInterface {
    name = 'InitRefConfigData1728625368807'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Проверяем, есть ли уже данные в ref_config_model
        const existingData = await queryRunner.query(`SELECT COUNT(*) FROM ref_config_model`);
        
        if (existingData[0].count === '0') {
            // Если данных нет, вставляем начальные значения
            await queryRunner.query(`
                INSERT INTO ref_config_model (level_1_percent, level_2_percent, level_3_percent)
                VALUES (0.6, 0.3, 0.1)
            `);
            console.log('Initial data inserted into ref_config_model');
        } else {
            console.log('ref_config_model already contains data, skipping initialization');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('Reverting InitRefConfigData migration - no action taken');
    }
}