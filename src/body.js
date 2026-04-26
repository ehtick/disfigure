
// disfigure



import { MathUtils, Euler, Object3D, Quaternion, Vector3 } from 'three';
import { everybody, renderer } from './world.js';
import { EQ, EQ_POS } from './tsl.js';
import { JOINTS } from './assets.js';
import { Pool } from './pool.js';



// degrees-radian conversion
var toDeg = x => x * 180 / Math.PI,
	toRad = x => x / 180 * Math.PI;



// global unique identifier for bodies
var uid = 0;



// dummy variables
var _p = new Vector3(),
	_q = new Quaternion();


class EulerDegrees extends Euler {

	constructor( body, index, parentIndex, signs ) {

		super();

		this.body = body;
		this.index = index;
		this.parentIndex = parentIndex;
		this.signs = signs;
		this.quaternion = new Quaternion();
		this.needsUpdate = true;
		this.attached = [];

	}

	set( x, y, z ) {

		this.x = x;
		this.y = y;
		this.z = z;

	}

	set x( n ) {

		super.x = toRad( this.signs.x*n );
		this.needsUpdate = true;

	}

	set y( n ) {

		super.y = toRad( this.signs.y*n );
		this.needsUpdate = true;

	}

	set z( n ) {

		super.z = toRad( this.signs.z*n );
		this.needsUpdate = true;

	}

	get x( ) {

		return toDeg( this.signs.x*super.x );

	}

	get y( ) {

		return toDeg( this.signs.y*super.y );

	}

	get z( ) {

		return toDeg( this.signs.z*super.z );

	}

	get q( ) {

		if ( this.needsUpdate ) {

			this.quaternion.setFromEuler( this );
			this.needsUpdate = false;

		}

		return this.quaternion;

	}

	// attach object to current joint
	attach( object ) {

		object.initialPosition = object.position.clone();
		object.matrixAutoUpdate = false;

		this.attached.push( object );

		this.body.pool.add( object );


	}

}


class Body extends Object3D {

	constructor( pool ) {

		super();

		this.pool = pool;
		this.pid = pool.getBody(); // instance index within the pool
		this.uid = uid++; // global index

		this.eulers = [];

		for ( var i=0; i<EQ; i++ ) {

			this.eulers.push( new EulerDegrees( this, i, JOINTS[ i ].parentIndex, JOINTS[ i ].signs ) );

			this[ JOINTS[ i ].name ] = this.eulers[ i ];

		}

		everybody.push( this );

	}

	update( ) {

		this.updateMatrix();
		this.pool.setMatrixAt( this.pid, this.matrix );
		this.pool.instanceMatrix.needsUpdate = true;

		for ( var i=0; i<EQ-2; i++ ) {

			var euler = this.eulers[ i ];

			this.pool.setQ( this.pid, i, euler.q );

		} // for i

		this.pool.quatTexture.needsUpdate = true;

	} // Body.update

	updateAttached( ) {

		var pivots = this.pool.data?.pivots; // in Firefox pool.data is created later

		if ( !pivots ) return;

		for ( var i=0; i<EQ-2; i++ ) {

			var _euler = this.eulers[ i ];

			for ( var object of _euler.attached ) {

				var euler = _euler;

				_p.copy( object.initialPosition );
				_p.add( pivots[ euler.index ].node.value );

				_q.identity();

				
				scan: while ( euler ) {
					var pivot = pivots[ euler.index ].node.value;

					_p.sub( pivot ).applyQuaternion( euler.quaternion ).add( pivot );
					_q.premultiply( euler.quaternion );

					if ( euler.parentIndex<0 ) break scan;

					euler = this.eulers[ euler.parentIndex ];

				}

				_p.multiply( this.scale );
				_p.add( this.position );

				object.position.copy( _p );
				object.quaternion.copy( _q );
				object.updateMatrix();


			} // for object

		} // for i

	} // Body.updateAttached



	get posture() {
		
		var r = x=>Math.round(100*(Object.is(x,-0)?0:x))/100; // round a number

		return {
			version: 9,
			position: [...this.position],
			angles: this.eulers.map( e=>[r(e.x), r(e.y), r(e.z)] ),
		};

	} // Body.get.posture 


	
	get posture() {
		
		var r = x=>Math.round(100*(Object.is(x,-0)?0:x))/100; // round a number

		return {
			version: 9,
			//position: [...this.position],
			angles: this.eulers.map( e=>[r(e.x), r(e.y), r(e.z)] ),
		};

	} // Body.get.posture 



	get postureString() {

		return JSON.stringify( this.posture );

	} // Body.get.postureString


	
	set posture( data ) {

		if ( data.version !=9 )
			throw error( 'Incompatible posture version' );

		//this.position.set( ...data.position );

		for ( var i in data.angles ) {
			this.eulers[i].x = data.angles[i][0];
			this.eulers[i].y = data.angles[i][1];
			this.eulers[i].z = data.angles[i][2];
		}

	} // Body.posture


	blend( postureA, postureB, k ) {

		function lerp( a, b ) {

			var c = [];
			for ( var i=0; i<a.length; i++ )
				c[ i ] = MathUtils.lerp( a[ i ], b[ i ], k );

			return c;

		}

		if ( postureA.version !=9 || postureB.version !=9 )
			throw error( 'Incompatible posture version' );

		this.posture = {
			version: 9,
			angles: postureA.angles.map((a, i) => lerp(a,postureB.angles[i])),
		};

	} // blend


} // Body



class Man extends Body {

	static pool = null;
	static count = 10; // max number of men
	static lowpoly = 0; // lowpoly-ness, 0=original, 1.0 remove 75%
	static vertexStage = false; // true for faster but uglier normals

	constructor( height = 1.80 ) {

		if ( Man.pool == null ) {

			Man.pool = new Pool( 'man', Man.count, Man.lowpoly, Man.vertexStage );

		}

		super( Man.pool );

		this.material = Man.pool.material; // expose to outside

		this.scale.setScalar( height/1.795 ); // 1.795 is 3D model height

		this.l_arm.z = this.r_arm.z = -75;
		this.l_elbow.y = this.r_elbow.y = 20;
		this.l_leg.z = this.r_leg.z = 10;
		this.l_ankle.z = this.r_ankle.z = -10;
		this.l_ankle.x = this.r_ankle.x = 3;

		this.position.y = -0.012;

	}

} // Man



class Woman extends Body {

	static pool = null;
	static count = 10; // max number of women
	static lowpoly = 0; // lowpoly-ness, 0=original, 1.0 remove 75%
	static vertexStage = false; // true for faster but uglier normals

	constructor( height = 1.70 ) {

		if ( Woman.pool == null ) {

			Woman.pool = new Pool( 'woman', Woman.count, Woman.lowpoly, Woman.vertexStage );

		}

		super( Woman.pool );

		this.material = Woman.pool.material; // expose to outside

		this.scale.setScalar( height/1.691 ); // 1.691 is 3D model height

		this.l_arm.z = this.r_arm.z = -90;
		this.l_elbow.y = this.r_elbow.y = 0;
		this.l_leg.z = this.r_leg.z = -3;
		this.l_ankle.z = this.r_ankle.z = 3;
		this.l_ankle.x = this.r_ankle.x = 3;

	}

} // Woman



class Child extends Body {

	static pool = null;
	static count = 10; // max number of children
	static lowpoly = 0; // lowpoly-ness, 0=original, 1.0 remove 75%
	static vertexStage = false; // true for faster but uglier normals

	constructor( height = 1.35 ) {

		if ( Child.pool == null ) {

			Child.pool = new Pool( 'child', Child.count, Child.lowpoly, Child.vertexStage );

		}

		super( Child.pool );

		this.material = Child.pool.material; // expose to outside

		this.scale.setScalar( height/1.352 ); // 1.352 is 3D model height

		this.l_arm.x = this.r_arm.x = -10;
		this.l_arm.z = this.r_arm.z = -80;
		this.l_ankle.bend = this.r_ankle.bend = 3;

		this.position.y = -0.008;

	}

} // Child
	
	
export { Man, Woman, Child };
