const {BadRequestError}=require('../errors/');

const testUser = (req,res,next) =>{
    if (req.user.testUser){
        throw new BadRequestError('Test user is in Read-Only mode');
    }
    next()
}

module.exports=testUser;