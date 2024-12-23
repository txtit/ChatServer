'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class GroupMessage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  GroupMessage.init({
    senderId: DataTypes.STRING,
    groupId: DataTypes.STRING,
    messageText: DataTypes.TEXT,
    sentAt: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'GroupMessage',
  });
  return GroupMessage;
};