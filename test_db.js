const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://ManishDeorari:ManDeo001@cluster0.kgk80.mongodb.net/student-portal-db?retryWrites=true&w=majority')
  .then(() => mongoose.connection.collection('posts').find({ 'images.0': { $exists: true } }).sort({createdAt: -1}).limit(3).toArray())
  .then(posts => {
    console.log(JSON.stringify(posts.map(p => ({ id: p._id, images: p.images })), null, 2));
    process.exit(0);
  });
