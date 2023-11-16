const Job = require('../models/Job')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors');
const mongoose=require('mongoose');
const moment=require('moment');
const { query } = require('express');

const getAllJobs = async (req, res) => {
  const {search, status, jobType, sort}=req.query;

  const queryObject={
    createdBy: req.user.userId
  };
  

  if (search){
    queryObject.position={$regex:search, $options:'i'}
  }

  //queryObject for status
  if (status !=='all'){
    queryObject.status=status;
  }

  //queryObject for job type
  if (jobType !== 'all'){
    queryObject.jobType=jobType;
  }

  
  let result = Job.find(queryObject);

  //setup for sort
  if (sort==='latest'){
    result.sort('-createdAt');
  }

  if (sort==='oldest'){
    result.sort('createdAt');
  }

  if (sort==='a-z'){
    result.sort('position');
  }

  if (sort==='z-a'){
    result.sort('-position')
  }

  //setup pagination
  const page=Number(req.query.page) || 1;
  const limit= Number(req.query.limit) || 10;
  const skip= (page-1)*limit;

  result=result.skip(skip).limit(limit);

  const jobs= await result;

  const totalJobs= await Job.countDocuments(queryObject);
  const numOfPages= Math.ceil(totalJobs/limit);


  res.status(StatusCodes.OK).json({jobs, totalJobs, numOfPages});
}
const getJob = async (req, res) => {
  const {
    user: { userId },
    params: { id: jobId },
  } = req

  const job = await Job.findOne({
    _id: jobId,
    createdBy: userId,
  })
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`)
  }
  res.status(StatusCodes.OK).json({ job })
}

const createJob = async (req, res) => {
  req.body.createdBy = req.user.userId
  const job = await Job.create(req.body)
  res.status(StatusCodes.CREATED).json({ job })
}

const updateJob = async (req, res) => {
  const {
    body: { company, position },
    user: { userId },
    params: { id: jobId },
  } = req

  if (company === '' || position === '') {
    throw new BadRequestError('Company or Position fields cannot be empty')
  }
  const job = await Job.findByIdAndUpdate(
    { _id: jobId, createdBy: userId },
    req.body,
    { new: true, runValidators: true }
  )
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`)
  }
  res.status(StatusCodes.OK).json({ job })
}

const deleteJob = async (req, res) => {
  const {
    user: { userId },
    params: { id: jobId },
  } = req

  const job = await Job.findByIdAndRemove({
    _id: jobId,
    createdBy: userId,
  })
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`)
  }
  res.status(StatusCodes.OK).send()
}

const showStats= async (req,res)=>{
  //aggregate pipeline of document
  let stats = await Job.aggregate([
    {$match:{ createdBy : mongoose.Types.ObjectId(req.user.userId)}},
    {$group: {_id:'$status', count:{$sum:1}}}
  ])
  //console.log(stats) [{ _id: 'declined', count: 27 },{ _id: 'pending', count: 19 },{ _id: 'interview', count: 30 }]
  stats=stats.reduce((acc,curr)=>{
    const {_id:title,count}=curr;
    acc[title]=count;
    return acc;
  },{})

  //console.log(stats) { pending: 19, interview: 30, declined: 27 }
  const defaultStats= {
    pending: stats.pending || 0,
    interview: stats.interview || 0,
    declined: stats.declined || 0
  }

  //aggregate pipeline of document
  let monthlyApplications= await Job.aggregate([
    {$match:{createdBy:mongoose.Types.ObjectId(req.user.userId)}},
    {
      $group:{
        _id:{year:{$year:'$createdAt'}, month:{$month:'$createdAt'}},
        count:{$sum:1}
      }
    },
    {$sort:{'_id.year':-1, '_id.month':-1}},
    {$limit:6}
  ])

  //console.log(monthlyApplications);
  //[
    //{ _id: { year: 2023, month: 11 }, count: 5 },
    //{ _id: { year: 2023, month: 10 }, count: 6 },
    // { _id: { year: 2023, month: 9 }, count: 6 },
    // { _id: { year: 2023, month: 8 }, count: 6 },
    // { _id: { year: 2023, month: 7 }, count: 7 },
    // { _id: { year: 2023, month: 6 }, count: 7 }
  //]

  monthlyApplications=monthlyApplications
  .map((item)=>{
    const{
      _id:{year,month},
      count
    }=item;

    const date= moment()
      .month(month-1)
      .year(year)
      .format('MMM Y')
    return {date,count}
  })
  .reverse();

  //console.log(monthlyApplications);
  //[
  //   { date: 'Jun 2023', count: 7 },
  //   { date: 'Jul 2023', count: 7 },
  //   { date: 'Aug 2023', count: 6 },
  //   { date: 'Sep 2023', count: 6 },
  //   { date: 'Oct 2023', count: 6 },
  //   { date: 'Nov 2023', count: 5 }
  // ]
  res
    .status(StatusCodes.OK)
    .json({defaultStats, monthlyApplications});
}

module.exports = {
  createJob,
  deleteJob,
  getAllJobs,
  updateJob,
  getJob,
  showStats
}
