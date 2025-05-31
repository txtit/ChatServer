'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Storie extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Storie.belongsTo(models.User, { foreignKey: 'userId', targetKey: 'id', as: 'user' });
    }
  }
  Storie.init({
    userId: DataTypes.STRING,
    mediaUrl: DataTypes.STRING,
    expiresAt: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Storie',
  });
  return Storie;
};