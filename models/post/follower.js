'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Follower extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Follower.belongsTo(models.User, { foreignKey: 'followerId', targetKey: 'id', as: 'user' });
      Follower.belongsTo(models.User, { foreignKey: 'followingId', targetKey: 'id', as: 'user' });
    }
  }
  Follower.init({
    followerId: DataTypes.STRING,
    followingId: DataTypes.STRING,
    followedAt: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Follower',
  });
  return Follower;
};