// 'use strict';
// const {
//   Model
// } = require('sequelize');
// const { enumData } = require('../utils/contansts');
// module.exports = (sequelize, DataTypes) => {
//   class GroupNotification extends Model {
//     /**
//      * Helper method for defining associations.
//      * This method is not a part of Sequelize lifecycle.
//      * The `models/index` file will call this method automatically.
//      */
//     static associate(models) {
//       // define association here
//     }
//   }
//   GroupNotification.init({
//     groupId: DataTypes.STRING,
//     recipientId: DataTypes.STRING,
//     senderId: DataTypes.STRING,
//     notificationTypeGroup: {
//       type: DataTypes.ENUM,
//       values: enumData.notificationTypeGroup
//     },
//     referenceId: DataTypes.STRING,
//     seen: {
//       type: DataTypes.BOOLEAN,
//       defaultValue: false
//     },
//   }, {
//     sequelize,
//     modelName: 'GroupNotification',
//   });
//   return GroupNotification;
// };